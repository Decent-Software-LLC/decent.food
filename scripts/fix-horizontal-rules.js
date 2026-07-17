const fs = require('fs');
const path = require('path');

const GUIDES_DIR = path.join(__dirname, '..', '_guides');

function fixHorizontalRules(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');

  // Split into front matter and body
  const frontMatterMatch = content.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);

  if (!frontMatterMatch) {
    console.log(`Warning: Could not parse front matter in ${path.basename(filepath)}`);
    return { modified: false, issues: [] };
  }

  const frontMatter = frontMatterMatch[1];
  let body = frontMatterMatch[2];
  let modified = false;
  const issues = [];

  // Split body into lines for processing
  const lines = body.split('\n');
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
    const prevLine = i > 0 ? lines[i - 1] : '';

    // Check for H2 markdown underline (dashes) that comes after a header
    // Pattern: ## Header\n-------
    if (line.startsWith('## ') && /^-{3,}$/.test(nextLine)) {
      result.push(line);
      i++; // Skip the dashes line
      modified = true;
      issues.push('removed-h2-underline');
      continue;
    }

    // Check for text with dashes underneath (converts to ## header)
    // Pattern: Some Text\n-------
    if (
      !line.startsWith('##') &&
      !line.startsWith('**') &&
      line.trim().length > 0 &&
      /^-{3,}$/.test(nextLine) &&
      !prevLine.match(/^=+$/) // Not preceded by equals (that's the title)
    ) {
      // Convert to ## header
      result.push(`## ${line.trim()}`);
      i++; // Skip the dashes line
      modified = true;
      issues.push('converted-underline-to-h2');
      continue;
    }

    // Check for bold text with dashes underneath
    // Pattern: **Some Text**\n-------
    if (
      line.match(/^\*\*.*\*\*$/) &&
      /^-{3,}$/.test(nextLine) &&
      !prevLine.match(/^=+$/) // Not preceded by equals (that's the title)
    ) {
      // Extract text from bold
      const text = line.replace(/^\*\*(.*)\*\*$/, '$1');
      result.push(`## ${text}`);
      i++; // Skip the dashes line
      modified = true;
      issues.push('converted-bold-underline-to-h2');
      continue;
    }

    // Check for standalone horizontal rule lines (3+ dashes on their own)
    if (/^-{3,}$/.test(line)) {
      // Check if previous non-empty line was already a header
      const prevNonEmpty = result.slice().reverse().find(l => l.trim() !== '');
      if (prevNonEmpty && prevNonEmpty.startsWith('## ')) {
        // Skip this redundant horizontal rule
        modified = true;
        issues.push('removed-redundant-hr');
        continue;
      }
    }

    result.push(line);
  }

  if (modified) {
    const newContent = frontMatter + result.join('\n');
    fs.writeFileSync(filepath, newContent);
  }

  return { modified, issues: [...new Set(issues)] };
}

function main() {
  console.log('🔧 Fixing Horizontal Rules in Guides\n');
  console.log('===================================\n');

  const guideFiles = fs.readdirSync(GUIDES_DIR)
    .filter(file => file.endsWith('.md'))
    .sort();

  let fixed = 0;
  const allIssues = {};

  for (const file of guideFiles) {
    const filepath = path.join(GUIDES_DIR, file);
    const result = fixHorizontalRules(filepath);

    if (result.modified) {
      console.log(`✓  ${file}: Fixed ${result.issues.join(', ')}`);
      fixed++;
      result.issues.forEach(issue => {
        allIssues[issue] = (allIssues[issue] || 0) + 1;
      });
    }
  }

  console.log('\n===================================');
  console.log(`\n📊 Summary: Fixed ${fixed} guides`);

  if (Object.keys(allIssues).length > 0) {
    console.log('\n   Issues fixed:');
    Object.entries(allIssues).forEach(([issue, count]) => {
      console.log(`     - ${issue}: ${count}`);
    });
  }

  console.log('\n✨ Done!\n');
}

if (require.main === module) {
  main();
}

module.exports = { main };
