const fs = require('fs');
const path = require('path');

const GUIDES_DIR = path.join(__dirname, '..', '_guides');

// Parse a guide file
function parseGuide(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');

  // More forgiving regex that handles:
  // - Optional whitespace around --- markers
  // - Files that don't end with newline
  // - Different line ending styles
  const frontMatterMatch = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);

  if (!frontMatterMatch) {
    return null;
  }

  return {
    frontMatter: frontMatterMatch[1],
    body: frontMatterMatch[2],
    fullContent: content
  };
}

// Fix title formatting by removing legacy equals-sign underlines
function fixTitle(body) {
  const lines = body.split('\n');
  let fixed = false;

  for (let i = 0; i < lines.length; i++) {
    if (/^=+$/.test(lines[i].trim())) {
      lines.splice(i, 1);
      fixed = true;
      i--;
    }
  }

  return { body: lines.join('\n'), fixed };
}

// Fix section headers (should use ##)
function fixSectionHeaders(body) {
  let fixed = false;
  const lines = body.split('\n');
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';

    // Skip if already an H2 header
    if (line.startsWith('## ')) {
      result.push(line);
      continue;
    }


    // Check for common section patterns that should be headers
    const headerPatterns = [
      /^\*\*(Prerequisites|What is|Why |How |Types? of|Real-World Examples?|Try It Yourself|Key Takeaways?|Further Reading|Related Guides?)\*\*$/i,
      /^\*\*(Step \d+:.*)\*\*$/
    ];

    let isHeader = false;
    for (const pattern of headerPatterns) {
      if (pattern.test(line)) {
        // Extract text without asterisks
        const text = line.replace(/^\*\*(.*)\*\*$/, '$1');
        result.push(`## ${text}`);
        fixed = true;
        isHeader = true;
        break;
      }
    }

    if (!isHeader) {
      result.push(line);
    }
  }

  return { body: result.join('\n'), fixed };
}

// Fix callouts (should use > blockquote syntax)
function fixCallouts(body) {
  let fixed = false;

  // Pattern: **💡 Pro Tip:** or **⚠️ Watch Out:** or **🎯 Key Insight:** not preceded by >
  const calloutPattern = /^(\*\*[💡⚠️🎯].*?:?\*\*.*?)$/gm;

  const result = body.replace(calloutPattern, (match, content) => {
    // Check if this line isn't already in a blockquote
    const lines = body.split('\n');
    const lineIndex = lines.findIndex(line => line.includes(content));

    if (lineIndex >= 0 && !lines[lineIndex].startsWith('>')) {
      fixed = true;
      return `> ${content}`;
    }
    return match;
  });

  return { body: result, fixed };
}

// Check for empty Further Reading sections
function checkEmptyFurtherReading(body) {
  const lines = body.split('\n');
  let inFurtherReading = false;
  let isEmpty = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.match(/^##\s+Further Reading/i)) {
      inFurtherReading = true;
      continue;
    }

    if (inFurtherReading) {
      // Check if we hit another section
      if (line.startsWith('## ')) {
        break;
      }

      // Check if there's actual content (links or text)
      if (line.length > 0 && !line.match(/^(Here are|Additional|More)/i)) {
        isEmpty = false;
        break;
      }
    }
  }

  return inFurtherReading && isEmpty;
}

// Process a single guide
function processGuide(filename) {
  const filepath = path.join(GUIDES_DIR, filename);
  const guide = parseGuide(filepath);

  if (!guide) {
    console.log(`⚠️  ${filename}: Could not parse`);
    return { processed: false, issues: [] };
  }

  let body = guide.body;
  let anyFixed = false;
  const issues = [];

  // Fix title
  const titleResult = fixTitle(body);
  if (titleResult.fixed) {
    body = titleResult.body;
    anyFixed = true;
    issues.push('title');
  }

  // Fix section headers
  const headerResult = fixSectionHeaders(body);
  if (headerResult.fixed) {
    body = headerResult.body;
    anyFixed = true;
    issues.push('headers');
  }

  // Fix callouts
  const calloutResult = fixCallouts(body);
  if (calloutResult.fixed) {
    body = calloutResult.body;
    anyFixed = true;
    issues.push('callouts');
  }

  // Check for empty Further Reading
  const hasEmptyFurtherReading = checkEmptyFurtherReading(body);
  if (hasEmptyFurtherReading) {
    issues.push('empty-further-reading');
  }

  // Write back if anything was fixed
  if (anyFixed) {
    const newContent = `---\n${guide.frontMatter}\n---\n${body}`;
    fs.writeFileSync(filepath, newContent);
    console.log(`✓  ${filename}: Fixed ${issues.join(', ')}`);
    return { processed: true, issues };
  } else if (hasEmptyFurtherReading) {
    console.log(`⚠️  ${filename}: Has empty Further Reading section`);
    return { processed: false, issues };
  } else {
    console.log(`✓  ${filename}: Already properly formatted`);
    return { processed: false, issues: [] };
  }
}

// Main function
function main() {
  console.log('🔧 Guide Formatting Fixer\n');
  console.log('========================\n');

  const guideFiles = fs.readdirSync(GUIDES_DIR)
    .filter(file => file.endsWith('.md'))
    .sort();

  if (guideFiles.length === 0) {
    console.log('No guide files found');
    return;
  }

  console.log(`Found ${guideFiles.length} guide(s)\n`);

  const results = {
    fixed: 0,
    alreadyGood: 0,
    warnings: 0,
    issueTypes: {}
  };

  for (const file of guideFiles) {
    const result = processGuide(file);

    // Defensive check in case result is malformed
    if (!result || !result.issues) {
      console.log(`⚠️  ${file}: Unexpected result format`);
      results.warnings++;
      continue;
    }

    if (result.processed) {
      results.fixed++;
      result.issues.forEach(issue => {
        results.issueTypes[issue] = (results.issueTypes[issue] || 0) + 1;
      });
    } else if (result.issues.length > 0) {
      results.warnings++;
    } else {
      results.alreadyGood++;
    }
  }

  console.log('\n========================');
  console.log('\n📊 Summary:');
  console.log(`   ✓ Fixed: ${results.fixed}`);
  console.log(`   ✓ Already good: ${results.alreadyGood}`);
  console.log(`   ⚠️  Warnings: ${results.warnings}`);

  if (Object.keys(results.issueTypes).length > 0) {
    console.log('\n   Issues fixed:');
    Object.entries(results.issueTypes).forEach(([issue, count]) => {
      console.log(`     - ${issue}: ${count}`);
    });
  }

  console.log('\n✨ Done!\n');
}

if (require.main === module) {
  main();
}

module.exports = { main };
