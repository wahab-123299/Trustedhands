// backend/scripts/seedPress.js
const mongoose = require('mongoose');
const PressArticle = require('../models/PressArticle');
require('dotenv').config();

const sampleArticles = [
  {
    title: 'TrustedHand Launches New Artisan Verification System',
    excerpt: 'We are excited to announce a new verification system that ensures every artisan on our platform is thoroughly vetted and trusted by customers nationwide.',
    content: `
      <p>TrustedHand is proud to launch our new <strong>Artisan Verification System</strong>. This comprehensive process includes ID verification, skill assessment, and background checks to ensure quality service for all customers.</p>
      
      <h2>What Changed?</h2>
      <p>Starting today, all new artisans will go through this enhanced verification process. Existing artisans will be gradually migrated over the next 30 days.</p>
      
      <ul>
        <li><strong>Government ID verification</strong> — Every artisan must provide a valid national ID</li>
        <li><strong>Skill-based assessment tests</strong> — Practical tests for trade-specific skills</li>
        <li><strong>Customer review history analysis</strong> — Tracking performance over time</li>
        <li><strong>Background checks</strong> — For high-value services like real estate agents</li>
      </ul>
      
      <h2>Why This Matters</h2>
      <p>Customer trust is the foundation of our platform. With over 50,000 service completions, we have learned that verification directly correlates with customer satisfaction. Verified artisans receive 3x more job requests than unverified ones.</p>
      
      <blockquote>
        "This new system will help us maintain the highest standards of service quality across Nigeria."
        <cite>— Wale Adewale, CEO & Founder</cite>
      </blockquote>
      
      <p>Artisans who complete verification will receive a blue checkmark badge on their profile, increased visibility in search results, and priority matching for premium jobs.</p>
    `,
    category: 'update',
    coverImage: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80',
    author: { 
      name: 'Wale Adewale', 
      role: 'CEO & Founder',
      avatar: '/team/wale.jpg'
    },
    publishedAt: new Date('2025-06-15'),
    featured: true,
    isPublished: true,
    tags: ['verification', 'artisans', 'launch', 'trust'],
    readTime: 4
  },
  
  {
    title: 'TrustedHand Partners with Lagos State Government to Empower 10,000 Artisans',
    excerpt: 'A landmark partnership to empower 10,000 artisans across Lagos with digital skills, market access, and financial inclusion tools.',
    content: `
      <p>We are thrilled to announce our partnership with the <strong>Lagos State Ministry of Wealth Creation and Employment</strong>. This initiative will train and onboard 10,000 artisans onto the TrustedHand platform over the next 12 months.</p>
      
      <h2>Program Highlights</h2>
      <p>The program includes:</p>
      <ul>
        <li>Free registration and profile setup on TrustedHand</li>
        <li>Digital literacy training for artisans</li>
        <li>Access to premium features at no cost</li>
        <li>Micro-loan eligibility through partner banks</li>
        <li>Monthly workshops on customer service and pricing</li>
      </ul>
      
      <h2>Impact Goals</h2>
      <p>By the end of 2026, we aim to:</p>
      <ul>
        <li>Onboard 10,000 verified artisans in Lagos</li>
        <li>Facilitate ₦500 million in service transactions</li>
        <li>Create 2,000 new jobs through platform referrals</li>
      </ul>
      
      <p>Registration opens July 1, 2025. Artisans can sign up at any of the 20 designated centers across Lagos or online at trustedhand.org/lagos.</p>
    `,
    category: 'partnership',
    coverImage: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80',
    author: { 
      name: 'Sarah Okonkwo', 
      role: 'Head of Partnerships',
      avatar: '/team/sarah.jpg'
    },
    publishedAt: new Date('2025-06-20'),
    featured: true,
    isPublished: true,
    tags: ['partnership', 'lagos', 'government', 'empowerment'],
    readTime: 3
  },
  
  {
    title: 'How TrustedHand is Revolutionizing Home Services in Nigeria',
    excerpt: 'From plumbing to electrical work, see how our platform is transforming how Nigerians find and hire skilled artisans with trust and transparency.',
    content: `
      <p>The home services industry in Nigeria has long been fragmented and unreliable. TrustedHand is changing that narrative by providing a centralized platform where customers can find verified, reviewed, and skilled artisans with just a few clicks.</p>
      
      <h2>The Problem We Solve</h2>
      <p>Before TrustedHand, finding a reliable plumber or electrician meant:</p>
      <ul>
        <li>Asking neighbors for referrals</li>
        <li>Negotiating prices without benchmarks</li>
        <li>No recourse for poor service</li>
        <li>Security concerns about strangers in your home</li>
      </ul>
      
      <h2>Our Solution</h2>
      <p>TrustedHand provides:</p>
      <ul>
        <li><strong>Verified profiles</strong> — Every artisan is ID-checked and skill-tested</li>
        <li><strong>Transparent pricing</strong> — See rates upfront before booking</li>
        <li><strong>Secure payments</strong> — Escrow system protects both parties</li>
        <li><strong>Review system</strong> — Honest feedback from real customers</li>
        <li><strong>Insurance coverage</strong> — Up to ₦100,000 protection on jobs</li>
      </ul>
      
      <h2>By The Numbers</h2>
      <p>Since our launch in 2024:</p>
      <ul>
        <li>50,000+ successful job completions</li>
        <li>94% customer satisfaction rate</li>
        <li>12,000+ registered artisans</li>
        <li>₦2.5 billion in transactions facilitated</li>
        <li>Available in 15 states across Nigeria</li>
      </ul>
      
      <p>We are just getting started. Our goal is to become the most trusted marketplace for skilled services in Africa.</p>
    `,
    category: 'feature',
    coverImage: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80',
    author: { 
      name: 'Chinedu Okafor', 
      role: 'Product Manager',
      avatar: '/team/chinedu.jpg'
    },
    publishedAt: new Date('2025-06-25'),
    featured: true,
    isPublished: true,
    tags: ['feature', 'nigeria', 'home-services', 'trust'],
    readTime: 5
  },
  
  {
    title: 'TrustedHand Raises $2M Seed Round to Expand Across Africa',
    excerpt: 'Leading African VCs back TrustedHand mission to digitize the informal skilled trades sector across the continent.',
    content: `
      <p>TrustedHand has secured a <strong>$2 million seed funding round</strong> led by Ventures Platform and participation from Future Africa, Microtraction, and several angel investors.</p>
      
      <h2>What the Funding Enables</h2>
      <p>This investment will accelerate our expansion across Africa:</p>
      <ul>
        <li>Launch in Ghana and Kenya by Q4 2025</li>
        <li>Build out our verification infrastructure</li>
        <li>Expand the engineering team from 12 to 35</li>
        <li>Launch TrustedHand Pro for enterprise clients</li>
      </ul>
      
      <h2>Investor Quotes</h2>
      <blockquote>
        "TrustedHand is solving a real problem at massive scale. The informal economy represents 65% of employment in Africa, and digitizing it is a huge opportunity."
        <cite>— Dotun Olowoporoku, Managing Partner, Ventures Platform</cite>
      </blockquote>
      
      <p>We are grateful for the trust our investors have placed in us and remain committed to our mission of empowering skilled artisans across Africa.</p>
    `,
    category: 'press-release',
    coverImage: 'https://images.unsplash.com/photo-1553729459-afe608c4d5a3?w=800&q=80',
    author: { 
      name: 'Wale Adewale', 
      role: 'CEO & Founder',
      avatar: '/team/wale.jpg'
    },
    publishedAt: new Date('2025-07-01'),
    featured: false,
    isPublished: true,
    tags: ['funding', 'investment', 'africa', 'expansion'],
    readTime: 3
  },
  
  {
    title: 'New Feature: Instant Quotes for Customers',
    excerpt: 'Get price estimates from multiple artisans in minutes with our new instant quote feature.',
    content: `
      <p>We are excited to announce <strong>Instant Quotes</strong> — a new feature that allows customers to receive price estimates from multiple artisans within minutes of posting a job.</p>
      
      <h2>How It Works</h2>
      <ol>
        <li>Post your job with details and photos</li>
        <li>Artisans review and submit quotes</li>
        <li>Compare prices, ratings, and portfolios</li>
        <li>Choose the best artisan for your needs</li>
      </ol>
      
      <h2>Benefits</h2>
      <ul>
        <li><strong>Save time</strong> — No more calling multiple artisans</li>
        <li><strong>Compare fairly</strong> — See all quotes side by side</li>
        <li><strong>Budget better</strong> — Know costs before committing</li>
        <li><strong>Negotiate less</strong> — Transparent pricing upfront</li>
      </ul>
      
      <p>Instant Quotes is available now for all service categories. Try it today!</p>
    `,
    category: 'update',
    coverImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80',
    author: { 
      name: 'Amara Nwosu', 
      role: 'Head of Product',
      avatar: '/team/amara.jpg'
    },
    publishedAt: new Date('2025-07-05'),
    featured: false,
    isPublished: true,
    tags: ['feature', 'quotes', 'pricing', 'update'],
    readTime: 2
  },
  
  {
    title: 'Customer Story: How Mrs. Adeyemi Found Her Perfect Interior Designer',
    excerpt: 'A Lagos homeowner shares her experience finding a reliable interior designer through TrustedHand.',
    content: `
      <p>When Mrs. Adeyemi decided to renovate her living room in Lekki, she had no idea where to start. "I had been burned before by an artisan who took my deposit and disappeared," she recalls.</p>
      
      <h2>The Search</h2>
      <p>Mrs. Adeyemi discovered TrustedHand through a friend. She posted her job — a complete living room makeover with a ₦500,000 budget — and within 2 hours had 5 quotes from verified interior designers.</p>
      
      <h2>The Choice</h2>
      <p>She chose Tolu Designs, a verified artisan with 47 five-star reviews. "The reviews gave me confidence. I could see photos of his past work and read what other customers said about him."</p>
      
      <h2>The Result</h2>
      <p>The project was completed in 3 weeks, on budget. "The escrow payment system was a game-changer. I released funds only when milestones were completed. I felt safe throughout."</p>
      
      <blockquote>
        "TrustedHand turned what could have been a nightmare into a beautiful experience. My living room is now the envy of my friends!"
        <cite>— Mrs. Adeyemi, Lekki, Lagos</cite>
      </blockquote>
      
      <p>Have a success story? Share it with us at stories@trustedhand.org.</p>
    `,
    category: 'feature',
    coverImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80',
    author: { 
      name: 'Chioma Eze', 
      role: 'Content Lead',
      avatar: '/team/chioma.jpg'
    },
    publishedAt: new Date('2025-07-10'),
    featured: false,
    isPublished: true,
    tags: ['customer-story', 'interior-design', 'lagos', 'trust'],
    readTime: 4
  }
];

async function seedPress() {
  try {
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI not found in environment');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🟢 Connected to MongoDB');

    // Clear existing articles
    const deleted = await PressArticle.deleteMany({});
    console.log(`🗑️  Cleared ${deleted.deletedCount} existing articles`);

    // Insert sample articles
    const inserted = await PressArticle.insertMany(sampleArticles);
    console.log(`✅ Inserted ${inserted.length} sample articles`);

    // Log what was created
    console.log('\n📰 Articles created:');
    inserted.forEach(article => {
      console.log(`   ${article.featured ? '⭐' : '  '} [${article.category}] ${article.title}`);
      console.log(`      Slug: ${article.slug} | Read time: ${article.readTime} min`);
    });

    console.log('\n✨ Seed complete! Your Press & Media page now has content.');
    console.log('   Visit: http://localhost:5173/press');

  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run if executed directly
if (require.main === module) {
  seedPress();
}

module.exports = seedPress;