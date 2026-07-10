const fs = require('fs');
const path = require('path');

// File paths
const GUIDES_DIR = path.join(__dirname, '..', '_guides');
const TOPICS_FILE = path.join(__dirname, '..', 'topics.json');

// Convert title to slug format
function titleToSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Parse frontmatter and content from guide
function parseGuide(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontMatterMatch) {
    return null;
  }

  return {
    frontMatterText: frontMatterMatch[1],
    content: frontMatterMatch[2],
    fullContent: content
  };
}

// Check if frontmatter already has series metadata
function hasSeries(frontMatterText) {
  return /\nseries:/m.test(frontMatterText);
}

// Add series metadata to frontmatter
function addSeriesToFrontmatter(frontMatterText, series) {
  // Find the best place to insert series (after tags, before description or image)
  const lines = frontMatterText.split('\n');
  let insertIndex = -1;

  // Try to insert after tags or article type
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('tags:')) {
      insertIndex = i + 1;
      break;
    } else if (lines[i].startsWith('article_type:')) {
      insertIndex = i + 1;
    }
  }

  // If we didn't find a good spot, insert before description or image
  if (insertIndex === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('description:') || lines[i].startsWith('image:')) {
        insertIndex = i;
        break;
      }
    }
  }

  // Fallback: insert at the end
  if (insertIndex === -1) {
    insertIndex = lines.length;
  }

  // Format series metadata with proper indentation
  const seriesLines = [];
  seriesLines.push('series:');
  seriesLines.push(`  name: "${series.name}"`);
  seriesLines.push(`  part: ${series.part}`);
  seriesLines.push(`  total: ${series.total}`);
  if (series.previous) {
    seriesLines.push(`  previous: "${series.previous}"`);
  }
  if (series.next) {
    seriesLines.push(`  next: "${series.next}"`);
  }

  // Insert series metadata with proper spacing
  lines.splice(insertIndex, 0, ...seriesLines);

  return lines.join('\n');
}

// Main function
function main() {
  console.log('🔧 Fixing Series Metadata...\n');

  // Load topics
  const topics = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf-8'));

  // Get all guide files
  const guideFiles = fs.readdirSync(GUIDES_DIR).filter(f => f.endsWith('.md'));

  // Create a map of slug -> filename
  const slugToFile = {};
  guideFiles.forEach(filename => {
    const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
    slugToFile[slug] = filename;
  });

  let fixed = 0;
  let skipped = 0;
  let notFound = 0;

  // Process each topic that has series metadata
  topics.forEach(topic => {
    if (!topic.series) {
      return;
    }

    const slug = titleToSlug(topic.title);
    const filename = slugToFile[slug];

    if (!filename) {
      console.log(`⚠️  Guide not found: ${topic.title}`);
      notFound++;
      return;
    }

    const filePath = path.join(GUIDES_DIR, filename);
    const guideData = parseGuide(filePath);

    if (!guideData) {
      console.log(`⚠️  Could not parse: ${filename}`);
      return;
    }

    // Check if already has series
    if (hasSeries(guideData.frontMatterText)) {
      console.log(`✓ Already has series: ${filename}`);
      skipped++;
      return;
    }

    // Add series metadata
    const updatedFrontMatter = addSeriesToFrontmatter(guideData.frontMatterText, topic.series);
    const updatedContent = `---\n${updatedFrontMatter}\n---\n${guideData.content}`;

    // Write back to file
    fs.writeFileSync(filePath, updatedContent);
    console.log(`✅ Added series metadata: ${filename}`);
    console.log(`   ${topic.series.name} (Part ${topic.series.part}/${topic.series.total})`);
    fixed++;
  });

  console.log('\n📊 SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Fixed: ${fixed} guides`);
  console.log(`Skipped (already has series): ${skipped} guides`);
  console.log(`Not found: ${notFound} guides`);
  console.log(`Total processed: ${topics.filter(t => t.series).length} topics with series`);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
