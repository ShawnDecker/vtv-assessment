/**
 * Running From Miracles - Daily Devotional Generator
 * Generates 60 days of devotional content from book chapters
 *
 * Usage: node scripts/generate-devotionals.js
 * Reads from: ValueToVictory/04-Content/RFM-Book/rfm-structured.json
 * Outputs to: ValueToVictory/04-Content/RFM-Book/devotionals.json
 */

const fs = require('fs');
const path = require('path');

const BOOK_DIR = path.join(__dirname, '..', '..', 'ValueToVictory', '04-Content', 'RFM-Book');
const STRUCTURED_PATH = path.join(BOOK_DIR, 'rfm-structured.json');

// Theme-to-scripture mapping for chapters without explicit verses
const THEME_SCRIPTURES = {
  faith: [
    { ref: 'Hebrews 11:1', text: 'Now faith is the substance of things hoped for, the evidence of things not seen.' },
    { ref: 'Romans 8:28', text: 'And we know that all things work together for good to them that love God.' },
    { ref: 'Jeremiah 29:11', text: 'For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you.' },
    { ref: 'Philippians 4:13', text: 'I can do all things through Christ who strengthens me.' },
    { ref: 'Psalm 46:1', text: 'God is our refuge and strength, a very present help in trouble.' },
  ],
  family: [
    { ref: 'Proverbs 22:6', text: 'Train up a child in the way he should go: and when he is old, he will not depart from it.' },
    { ref: 'Joshua 24:15', text: 'As for me and my house, we will serve the LORD.' },
    { ref: 'Psalm 127:3', text: 'Children are a heritage from the LORD, offspring a reward from him.' },
    { ref: 'Ephesians 6:4', text: 'Fathers, do not provoke your children to anger, but bring them up in the discipline and instruction of the Lord.' },
  ],
  poverty: [
    { ref: 'Philippians 4:19', text: 'And my God will meet all your needs according to the riches of his glory in Christ Jesus.' },
    { ref: 'Psalm 34:10', text: 'Those who seek the LORD lack no good thing.' },
    { ref: 'Matthew 6:26', text: 'Look at the birds of the air; they do not sow or reap, yet your heavenly Father feeds them.' },
  ],
  forgiveness: [
    { ref: 'Ephesians 4:32', text: 'Be kind to one another, tenderhearted, forgiving one another, as God in Christ forgave you.' },
    { ref: 'Matthew 6:14', text: 'For if you forgive other people when they sin against you, your heavenly Father will also forgive you.' },
    { ref: 'Colossians 3:13', text: 'Bear with each other and forgive one another if any of you has a grievance against someone.' },
  ],
  identity: [
    { ref: 'Psalm 139:14', text: 'I praise you because I am fearfully and wonderfully made.' },
    { ref: '2 Corinthians 5:17', text: 'Therefore, if anyone is in Christ, the new creation has come: The old has gone, the new is here!' },
    { ref: 'Jeremiah 1:5', text: 'Before I formed you in the womb I knew you, before you were born I set you apart.' },
  ],
  marriage: [
    { ref: 'Ecclesiastes 4:12', text: 'A cord of three strands is not quickly broken.' },
    { ref: 'Genesis 2:24', text: 'That is why a man leaves his father and mother and is united to his wife, and they become one flesh.' },
    { ref: 'Proverbs 18:22', text: 'He who finds a wife finds what is good and receives favor from the LORD.' },
  ],
  perseverance: [
    { ref: 'James 1:2-4', text: 'Consider it pure joy when you face trials of many kinds, because the testing of your faith produces perseverance.' },
    { ref: 'Galatians 6:9', text: 'Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.' },
    { ref: 'Romans 5:3-4', text: 'We also glory in our sufferings, because suffering produces perseverance; perseverance, character; and character, hope.' },
  ],
  transformation: [
    { ref: 'Romans 12:2', text: 'Do not conform to the pattern of this world, but be transformed by the renewing of your mind.' },
    { ref: 'Isaiah 43:19', text: 'See, I am doing a new thing! Now it springs up; do you not perceive it?' },
    { ref: 'Ezekiel 36:26', text: 'I will give you a new heart and put a new spirit in you.' },
  ],
  miracles: [
    { ref: 'Luke 1:37', text: 'For with God nothing shall be impossible.' },
    { ref: 'Psalm 77:14', text: 'You are the God who performs miracles; you display your power among the peoples.' },
    { ref: 'Mark 9:23', text: 'Everything is possible for one who believes.' },
  ],
  value: [
    { ref: 'Matthew 10:31', text: 'So do not be afraid; you are worth more than many sparrows.' },
    { ref: 'Psalm 8:5', text: 'You have made them a little lower than the angels and crowned them with glory and honor.' },
    { ref: '1 Peter 2:9', text: 'But you are a chosen people, a royal priesthood, a holy nation, God\'s special possession.' },
  ],
  addiction: [
    { ref: 'John 8:36', text: 'So if the Son sets you free, you will be free indeed.' },
    { ref: '1 Corinthians 10:13', text: 'God is faithful; he will not let you be tempted beyond what you can bear.' },
    { ref: 'Romans 6:14', text: 'For sin shall no longer be your master, because you are not under the law, but under grace.' },
  ],
};

// Reflection templates
const REFLECTION_TEMPLATES = [
  "In this chapter, Shawn shares about {theme_desc}. Sometimes life throws us into situations we never asked for. But God is in the details — even the ones that hurt.",
  "Today's reading reminds us that {theme_desc}. Shawn's story proves that what looks like destruction is often preparation.",
  "Shawn walks us through {theme_desc}. If you've been through something similar, know this: your story isn't over. God writes redemption into the margins.",
  "This chapter hits different because {theme_desc}. The beauty of this testimony is that the mess became the message.",
  "Today we see {theme_desc}. Like Shawn, you may be running from the very miracle God placed in your path.",
];

// Theme descriptions
const THEME_DESCRIPTIONS = {
  birth: "the miracle of life itself — how God preserved him when doctors said it was impossible",
  poverty: "what it means to have nothing and still find everything in God's provision",
  family: "the complicated, beautiful, painful reality of family — and how God works through it all",
  faith: "trusting God when everything around you says there's no reason to believe",
  addiction: "the chains of addiction and the freedom that only comes from surrender",
  identity: "the lies we believe about who we are and the truth God speaks over us",
  forgiveness: "the hardest and most necessary act — forgiving what seems unforgivable",
  marriage: "building something lasting from broken pieces, and letting God be the foundation",
  military: "service, sacrifice, and finding discipline that would later serve a greater purpose",
  career: "how God positions us in places we never planned to be — for a reason",
  miracles: "recognizing the hand of God in what the world calls coincidence",
  perseverance: "refusing to quit when everything in you wants to give up",
  value: "discovering what you're truly worth — not by the world's measure, but by God's",
  transformation: "the moment everything changes — because God was working all along",
};

function generateDevotionals() {
  const data = JSON.parse(fs.readFileSync(STRUCTURED_PATH, 'utf-8'));
  const devotionals = [];
  let verseIndex = {};

  data.chapters.forEach((chapter, i) => {
    const dayNumber = i + 1;
    const primaryTheme = chapter.themes[0] || 'faith';
    const secondaryTheme = chapter.themes[1] || 'perseverance';

    // Pick scripture
    if (!verseIndex[primaryTheme]) verseIndex[primaryTheme] = 0;
    const themeVerses = THEME_SCRIPTURES[primaryTheme] || THEME_SCRIPTURES.faith;
    const verse = themeVerses[verseIndex[primaryTheme] % themeVerses.length];
    verseIndex[primaryTheme]++;

    // Pick reflection template
    const template = REFLECTION_TEMPLATES[i % REFLECTION_TEMPLATES.length];
    const themeDesc = THEME_DESCRIPTIONS[primaryTheme] || THEME_DESCRIPTIONS.faith;
    const reflection = template.replace('{theme_desc}', themeDesc);

    // Generate prayer
    const prayer = `Lord, thank You for Shawn's testimony about ${primaryTheme}. Help me to see Your hand in my own ${primaryTheme === 'birth' ? 'beginning' : primaryTheme}. Give me eyes to see the miracles I've been running from. In Jesus' name, Amen.`;

    // Action step
    const actionSteps = {
      faith: "Take 5 minutes today to write down one moment where God showed up when you least expected it.",
      family: "Reach out to one family member today — even if the relationship is complicated. A text is enough.",
      poverty: "If you're in a season of lack, write down three things you DO have. Gratitude shifts perspective.",
      forgiveness: "Think of someone you're holding a grudge against. Pray for them — not because they deserve it, but because you deserve freedom.",
      identity: "Write this on a sticky note and put it where you'll see it: 'I am who God says I am.'",
      marriage: "Do one unexpected kind thing for your spouse or partner today. No strings attached.",
      addiction: "If you're struggling, tell one person today. Secrets lose power in the light.",
      perseverance: "You're still here. That means it's not over. Write down one reason to keep going.",
      transformation: "What's one area of your life where you've seen change? Thank God for the progress, even if it's small.",
      value: "Ask yourself: 'Am I measuring my worth by God's standard or the world's?' Sit with that.",
      miracles: "Look back over the last week. Can you spot a 'coincidence' that might actually be God?",
      military: "Discipline is a gift. Apply one area of discipline from your past to a current challenge.",
      career: "Your work is not just a paycheck — it's a platform. How can you serve someone through it today?",
    };

    const actionStep = actionSteps[primaryTheme] || actionSteps.faith;

    // Podcast topic
    const podcastTopic = `Episode idea: "${chapter.title}" — ${themeDesc}. Raw conversation about how this chapter of Shawn's life connects to what listeners are going through today.`;

    // Social media post
    const socialPost = `"${chapter.title}" — ${verse.ref}: "${verse.text.substring(0, 80)}..." What miracle are you running from today? #RunningFromMiracles #ValueToVictory #Faith`;

    devotionals.push({
      day_number: dayNumber,
      chapter_number: parseInt(chapter.chapter),
      chapter_title: chapter.title,
      title: `Day ${dayNumber}: ${chapter.title}`,
      theme: primaryTheme,
      secondary_theme: secondaryTheme,
      scripture_reference: verse.ref,
      scripture_text: verse.text,
      reflection: reflection,
      prayer: prayer,
      action_step: actionStep,
      podcast_topic: podcastTopic,
      social_media_post: socialPost,
    });
  });

  // Save devotionals
  const outputPath = path.join(BOOK_DIR, 'devotionals.json');
  fs.writeFileSync(outputPath, JSON.stringify(devotionals, null, 2));
  console.log(`Generated ${devotionals.length} daily devotionals`);
  console.log(`Saved to: ${outputPath}`);

  // Also generate a readable devotional guide
  let guide = `# Running From Miracles\n## 60-Day Devotional Guide\n\n*Based on the book by Shawn E. Decker*\n\n---\n\n`;

  devotionals.forEach(d => {
    guide += `### ${d.title}\n\n`;
    guide += `**Theme:** ${d.theme}\n\n`;
    guide += `**Scripture:** ${d.scripture_reference}\n> "${d.scripture_text}"\n\n`;
    guide += `**Reflection:**\n${d.reflection}\n\n`;
    guide += `**Prayer:**\n${d.prayer}\n\n`;
    guide += `**Today's Step:**\n${d.action_step}\n\n`;
    guide += `---\n\n`;
  });

  const guidePath = path.join(BOOK_DIR, 'devotional-guide.md');
  fs.writeFileSync(guidePath, guide);
  console.log(`Devotional guide saved to: ${guidePath}`);

  return devotionals;
}

generateDevotionals();
