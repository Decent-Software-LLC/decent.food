const axios = require('axios');
const fs = require('fs');
const path = require('path');

// NVIDIA API Configuration
const NVIDIA_API_BASE = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = 'moonshotai/kimi-k2.5';

// File paths
const GUIDES_DIR = path.join(__dirname, '..', '_guides');
const REVIEW_REPORT_FILE = path.join(__dirname, '..', 'guide-review-report.json');

// Review criteria
const REVIEW_PROMPT = `You are a content quality reviewer for an AI educational website called "For Example AI". Review this guide and provide a detailed assessment.

REVIEW CRITERIA:

1. COMPLETENESS (Score 1-10)
   - Does the guide have all expected sections? (Introduction, Prerequisites, Main Content, Examples, Try It Yourself, Key Takeaways, Further Reading)
   - Are any sections incomplete or cut off mid-sentence?
   - Is the content fit appropriate for the article type?

2. COMPELLING QUALITY (Score 1-10)
   - Is the writing engaging and conversational?
   - Are there good analogies and real-world examples?
   - Does it have personality without being unprofessional?
   - Are there visual breaks (emojis, blockquotes, varied formatting)?

3. ACCURACY (Score 1-10)
   - Are technical concepts explained correctly?
   - Are there any factual errors or outdated information?
   - Are links and references valid and relevant?
   - Is the article type appropriate for the content?

4. SPECIFIC ISSUES
   - List any specific problems found (incomplete sections, errors, missing content, etc.)
   - Note any outdated information (especially if guide is from before 2025)

IMPORTANT: Respond with ONLY valid JSON. No markdown formatting, no code blocks, no additional text.

Respond in exactly this JSON format:
{
  "completeness_score": 8,
  "completeness_notes": "Brief explanation",
  "compelling_score": 7,
  "compelling_notes": "Brief explanation",
  "accuracy_score": 9,
  "accuracy_notes": "Brief explanation",
  "overall_score": 8.0,
  "needs_update": false,
  "issues": ["List of specific issues"],
  "recommendations": ["List of specific improvements"],
  "priority": "low"
}

The priority must be exactly one of: "low", "medium", or "high"`;

// Parse frontmatter and content from guide
function parseGuide(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontMatterMatch) {
    return { frontMatter: {}, content: content, raw: content };
  }

  const frontMatterText = frontMatterMatch[1];
  const bodyContent = frontMatterMatch[2];

  // Parse frontmatter
  const frontMatter = {};
  frontMatterText.split('\n').forEach(line => {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      frontMatter[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  });

  return { frontMatter, content: bodyContent, raw: content };
}

// Review a single guide using AI (with retry logic)
async function reviewGuide(guideData, filename, retryCount = 0) {
  const maxRetries = 2;
  console.log(`  Analyzing content...${retryCount > 0 ? ` (attempt ${retryCount + 1}/${maxRetries + 1})` : ''}`);

  const reviewPrompt = `${REVIEW_PROMPT}

GUIDE TO REVIEW:
Title: ${guideData.frontMatter.title || 'Unknown'}
Article type: ${guideData.frontMatter.article_type || 'Unknown'}
Date: ${guideData.frontMatter.date || 'Unknown'}
Estimated Time: ${guideData.frontMatter.estimated_time || 'Unknown'}

CONTENT:
${guideData.content}

Provide your review in the JSON format specified above.`;

  try {
    const response = await axios.post(
      `${NVIDIA_API_BASE}/chat/completions`,
      {
        model: NVIDIA_MODEL,
        messages: [
          {
            role: 'user',
            content: reviewPrompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent analysis
        top_p: 1,
        max_tokens: 4096, // Increased for complete JSON responses
        stream: false,
        mode: 'instant'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Check for null or empty response
    const rawContent = response.data.choices[0]?.message?.content;
    if (!rawContent) {
      console.error(`  API returned null or empty content`);
      throw new Error('API returned null response');
    }

    let reviewText = rawContent.trim();

    // Try to parse JSON from response with multiple strategies
    let review;
    try {
      // Try direct parse
      review = JSON.parse(reviewText);
    } catch {
      try {
        // Remove markdown code blocks if present
        reviewText = reviewText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

        // Try parsing after removing markdown
        try {
          review = JSON.parse(reviewText);
        } catch {
          // Try to find JSON object anywhere in the text
          const objectMatch = reviewText.match(/\{[\s\S]*\}/);
          if (objectMatch) {
            review = JSON.parse(objectMatch[0]);
          } else {
            throw new Error('Could not find JSON in response');
          }
        }
      } catch (parseError) {
        console.error(`  Debug - Raw response (first 1000 chars):`);
        console.error(reviewText.substring(0, 1000));
        throw new Error(`Could not parse JSON response: ${parseError.message}`);
      }
    }

    return review;

  } catch (error) {
    // Retry on null response or parsing errors
    const shouldRetry = (error.message.includes('null') || error.message.includes('parse')) && retryCount < maxRetries;

    if (shouldRetry) {
      console.log(`  ⚠️  ${error.message} - retrying in 3s...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      return reviewGuide(guideData, filename, retryCount + 1);
    }

    console.error(`  ✗ Error reviewing: ${error.message}`);

    // Check if it's an API error vs parsing error
    const errorType = error.response ? 'API Error' :
                      error.message.includes('parse') ? 'Parse Error' :
                      error.message.includes('null') ? 'Empty Response' : 'Unknown Error';

    return {
      error: true,
      message: error.message,
      error_type: errorType,
      completeness_score: 0,
      compelling_score: 0,
      accuracy_score: 0,
      overall_score: 0,
      needs_update: true,
      issues: [`Failed to review - ${errorType}: ${error.message}`],
      recommendations: ['Retry review manually'],
      priority: 'unknown'
    };
  }
}

// Get all guide files
function getAllGuides() {
  return fs.readdirSync(GUIDES_DIR)
    .filter(file => file.endsWith('.md'))
    .sort();
}

// Generate summary statistics
function generateSummary(results) {
  const total = results.length;
  const avgCompleteness = results.reduce((sum, r) => sum + (r.review.completeness_score || 0), 0) / total;
  const avgCompelling = results.reduce((sum, r) => sum + (r.review.compelling_score || 0), 0) / total;
  const avgAccuracy = results.reduce((sum, r) => sum + (r.review.accuracy_score || 0), 0) / total;
  const avgOverall = results.reduce((sum, r) => sum + (r.review.overall_score || 0), 0) / total;

  const needsUpdate = results.filter(r => r.review.needs_update).length;
  const highPriority = results.filter(r => r.review.priority === 'high').length;
  const mediumPriority = results.filter(r => r.review.priority === 'medium').length;
  const lowPriority = results.filter(r => r.review.priority === 'low').length;

  return {
    total_guides: total,
    averages: {
      completeness: avgCompleteness.toFixed(2),
      compelling: avgCompelling.toFixed(2),
      accuracy: avgAccuracy.toFixed(2),
      overall: avgOverall.toFixed(2)
    },
    needs_update_count: needsUpdate,
    priority_breakdown: {
      high: highPriority,
      medium: mediumPriority,
      low: lowPriority
    },
    review_date: new Date().toISOString()
  };
}

// Fix a guide based on review feedback
async function fixGuide(guideData, review, filename, filePath) {
  console.log(`  🔧 Fixing issues...`);

  const fixPrompt = `You are a content editor for "For Example AI". You previously reviewed this guide and found issues. Now fix them.

ORIGINAL GUIDE:
Title: ${guideData.frontMatter.title || 'Unknown'}
Article type: ${guideData.frontMatter.article_type || 'Unknown'}

CONTENT:
${guideData.content}

REVIEW FEEDBACK:
- Completeness Score: ${review.completeness_score}/10
  Notes: ${review.completeness_notes}
- Compelling Score: ${review.compelling_score}/10
  Notes: ${review.compelling_notes}
- Accuracy Score: ${review.accuracy_score}/10
  Notes: ${review.accuracy_notes}

Issues Found:
${review.issues.map(i => `- ${i}`).join('\n')}

Recommendations:
${review.recommendations.map(r => `- ${r}`).join('\n')}

INSTRUCTIONS:
1. Fix ALL issues identified in the review
2. Keep the same structure (Introduction, Prerequisites, Main Content, Examples, Try It Yourself, Key Takeaways, Further Reading)
3. Maintain the conversational, engaging tone with analogies and personality
4. Ensure all sections are complete and aligned with the ${guideData.frontMatter.article_type} article type
5. Fix any formatting issues, add missing links, correct technical errors
6. Return ONLY the updated markdown content (no frontmatter, no explanations)

Provide the complete, improved guide content:`;

  try {
    const response = await axios.post(
      `${NVIDIA_API_BASE}/chat/completions`,
      {
        model: NVIDIA_MODEL,
        messages: [{ role: 'user', content: fixPrompt }],
        temperature: 0.5,
        max_tokens: 8192,
        stream: false,
        mode: 'instant'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const fixedContent = response.data.choices[0]?.message?.content;
    if (!fixedContent) {
      throw new Error('API returned null response');
    }

    // Reconstruct the full file with frontmatter + fixed content
    // Use the original frontmatter section from the file to preserve formatting
    const frontMatterMatch = guideData.raw.match(/^---\n([\s\S]*?)\n---\n/);
    const originalFrontMatter = frontMatterMatch ? frontMatterMatch[0] : '---\n---\n';

    const fullContent = `${originalFrontMatter}\n${fixedContent.trim()}\n`;

    // Write the fixed guide back to file
    fs.writeFileSync(filePath, fullContent);
    console.log(`  ✅ Guide fixed and saved`);

    return true;
  } catch (error) {
    console.error(`  ✗ Error fixing guide: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  const autoFix = process.argv.includes('--fix');

  console.log(`🔍 Starting Content Quality Review${autoFix ? ' with Auto-Fix' : ''}...\n`);

  // Check for API key
  if (!process.env.NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY environment variable is not set');
  }

  // Get all guides
  const guideFiles = getAllGuides();
  console.log(`Found ${guideFiles.length} guides to review\n`);

  const results = [];
  let processed = 0;
  let fixed = 0;

  // Review each guide
  for (const filename of guideFiles) {
    processed++;
    const filePath = path.join(GUIDES_DIR, filename);

    console.log(`[${processed}/${guideFiles.length}] Reviewing: ${filename}`);

    try {
      // Parse guide
      const guideData = parseGuide(filePath);

      // Review with AI
      const review = await reviewGuide(guideData, filename);

      // Determine if guide needs fixing
      const needsFix = review.needs_update ||
                      review.overall_score < 8 ||
                      review.priority === 'high' ||
                      review.priority === 'medium';

      let fixApplied = false;
      if (autoFix && needsFix && !review.error) {
        fixApplied = await fixGuide(guideData, review, filename, filePath);
        if (fixApplied) {
          fixed++;
        }
      }

      results.push({
        filename,
        title: guideData.frontMatter.title || 'Unknown',
        date: guideData.frontMatter.date || 'Unknown',
        article_type: guideData.frontMatter.article_type || 'Unknown',
        review,
        fixed: fixApplied
      });

      // Print summary
      console.log(`  Overall Score: ${review.overall_score}/10`);
      console.log(`  Priority: ${review.priority}`);
      if (review.needs_update) {
        console.log(`  ⚠️  Needs update!`);
      }
      if (fixApplied) {
        console.log(`  ✅ Fixed and saved`);
      }
      console.log('');

      // Rate limiting - wait 2 seconds between requests (longer if we just fixed)
      if (processed < guideFiles.length) {
        await new Promise(resolve => setTimeout(resolve, fixApplied ? 3000 : 2000));
      }

    } catch (error) {
      console.error(`  ✗ Error processing: ${error.message}\n`);
      results.push({
        filename,
        error: true,
        message: error.message
      });
    }
  }

  // Generate summary
  const summary = generateSummary(results.filter(r => !r.error));

  // Create report
  const report = {
    summary,
    results: results.sort((a, b) => {
      // Sort by priority (high first) then by score (low first)
      const priorityOrder = { high: 0, medium: 1, low: 2, unknown: 3 };
      const aPriority = priorityOrder[a.review?.priority || 'unknown'];
      const bPriority = priorityOrder[b.review?.priority || 'unknown'];

      if (aPriority !== bPriority) return aPriority - bPriority;
      return (a.review?.overall_score || 0) - (b.review?.overall_score || 0);
    })
  };

  // Save report
  fs.writeFileSync(REVIEW_REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\n✅ Review complete! Report saved to: ${REVIEW_REPORT_FILE}`);

  // Print summary
  console.log('\n📊 SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Total guides reviewed: ${summary.total_guides}`);
  if (autoFix) {
    console.log(`Guides fixed: ${fixed}`);
  }
  console.log(`\nAverage Scores:`);
  console.log(`  Completeness: ${summary.averages.completeness}/10`);
  console.log(`  Compelling:   ${summary.averages.compelling}/10`);
  console.log(`  Accuracy:     ${summary.averages.accuracy}/10`);
  console.log(`  Overall:      ${summary.averages.overall}/10`);
  console.log(`\nNeeds Update: ${summary.needs_update_count} guides`);
  console.log(`\nPriority Breakdown:`);
  console.log(`  🔴 High:   ${summary.priority_breakdown.high}`);
  console.log(`  🟡 Medium: ${summary.priority_breakdown.medium}`);
  console.log(`  🟢 Low:    ${summary.priority_breakdown.low}`);

  // Print high priority items
  const highPriorityGuides = results.filter(r => r.review?.priority === 'high');
  if (highPriorityGuides.length > 0) {
    console.log(`\n🔴 HIGH PRIORITY UPDATES NEEDED:`);
    highPriorityGuides.forEach(g => {
      console.log(`\n  ${g.title} (${g.filename})`);
      console.log(`    Score: ${g.review.overall_score}/10`);
      if (g.review.issues && g.review.issues.length > 0) {
        console.log(`    Issues: ${g.review.issues.join(', ')}`);
      }
    });
  }

  console.log('\n');
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Error during review:', error);
    process.exit(1);
  });
}

module.exports = { main, reviewGuide, parseGuide };
