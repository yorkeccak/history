# History

**[history.valyu.ai](https://history.valyu.ai)**

> I can't stop doomscrolling Google Maps so I built AI that researches anywhere on Earth

An interactive 3D globe that lets you explore the fascinating history of any location on the planet. Born from opening Google Maps in satellite view at 2am and clicking on random shit - obscure atolls in the Pacific that look like someone dropped a pixel, unnamed mountains in Kyrgyzstan, Arctic settlements with 9 people. Places so remote they don't have Wikipedia pages.

![History](public/history.png)

## The Problem

I have a problem. I'll lose 6 hours to doomscrolling Google Maps. Just clicking. Finding volcanic islands that look photoshopped. Fjords that defy physics. Tiny dots of land in the middle of nowhere. And every single time I think: **what IS this place? Who found it? Why does it exist? What happened here?**

Then you try to research it and it's hell. 47 Wikipedia tabs. A poorly-translated Kazakh government PDF from 2003. A travel blog from 1987. A single Reddit comment from 2014 that says "I think my uncle went there once." You piece it together like a conspiracy theorist and still don't get the full story.

**The information exists somewhere.** Historical databases. Academic archives. Colonial records. Exploration logs from the 1800s. But it's scattered everywhere and takes forever to find.

## The Solution

Click anywhere on a globe. Get actual research. It searches hundreds of sources for up to 10 minutes and gives you the full story. With citations so you know it's not making shit up.

Not ChatGPT summarizing from training data. **Actual research.** It searches:
- Historical databases and archives
- Academic papers and journals
- Colonial records and exploration logs
- Archaeological surveys
- Wikipedia and structured knowledge bases
- Real-time web sources

**Example: Tristan da Cunha** (most remote inhabited island on Earth, population 245)

Click on it and you get:
- Discovery by Portuguese explorers in 1506
- British annexation in 1816 (strategic location during Napoleonic Wars)
- Volcanic eruption in 1961 that evacuated the entire population
- Current economy (crayfish export, philately)
- Cultural evolution of the tiny community
- Full timeline with sources

What would take hours of manual research happens automatically. And you can verify everything.

## Why This Exists

Because I've spent literal months of my life doomscrolling Google Maps clicking on random islands at 3am and I want to actually understand them. Not skim a 4-paragraph Wikipedia stub. Not guess based on the name. **Proper historical research. Fast.**

The databases exist. The archives are digitized. The APIs are built. Someone just needed to connect them to a globe and make it accessible.

**This is what AI should be doing.** Not writing emails. Augmenting genuine human curiosity about the world.

## Key Features

### Real Research Infrastructure
- **Valyu DeepResearch API** - Access to academic databases, archives, historical records
- **Runs for up to 10 minutes** - Searches hundreds of sources
- **Full citations** - Every claim linked to verifiable sources
- **Live progress tracking** - Watch the research unfold in real-time, see every source it queries

### Interactive Globe
- **3D Satellite Visualization** - Stunning Mapbox satellite imagery with globe projection
- **Click literally anywhere** - Any country, island, mountain, or geographical feature
- **Random Discovery** - "I'm Feeling Lucky" button for random location exploration
- **Multiple Map Styles** - Satellite, streets, outdoors, and more

### Save & Share
- **Research History** - Save and revisit your discoveries (signed-in users)
- **Shareable Links** - Generate public links to research
- **Mobile responsive** - Works on phone/tablet/desktop

### Works Anonymously
- **1 free query** - No signup required to try it
- **Sign up for more** - 3 free queries per day, or upgrade for unlimited

## Technology Stack

### Research
- **[Valyu DeepResearch API](https://platform.valyu.ai)** - Comprehensive search across databases, archives, academic sources

### Frontend
- **[Next.js 15](https://nextjs.org)** + **[React 19](https://react.dev)** - Modern web framework
- **[Mapbox GL JS](https://www.mapbox.com/mapbox-gljs)** - Interactive 3D globe visualization
- **[Tailwind CSS](https://tailwindcss.com)** + **[Framer Motion](https://www.framer.com/motion/)** - Beautiful UI with smooth animations
- **[React Markdown](https://github.com/remarkjs/react-markdown)** - Rendering research reports

### Backend
- **[Supabase](https://supabase.com)** - Authentication and database (production mode)
- **[SQLite](https://www.sqlite.org/)** - Local database (development mode)
- **[Polar](https://polar.sh)** - Subscription billing
- **[Drizzle ORM](https://orm.drizzle.team/)** - Type-safe database queries

### Infrastructure
- **[Vercel](https://vercel.com)** - Deployment and hosting
- **TypeScript** - Type safety throughout

Fully open-source. Self-hostable. Model-agnostic.

## Quick Start

### Prerequisites

**For Development Mode (Easiest - No Auth Required):**
- Node.js 18+
- pnpm, npm, or yarn
- Valyu DeepResearch API key ([get one free at platform.valyu.ai](https://platform.valyu.ai))
- Mapbox access token ([get one free at mapbox.com](https://account.mapbox.com))

**For Production Mode:**
- All of the above, plus:
- Supabase account and project
- Polar account for billing (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yorkeccak/history.git
   cd history
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or npm install
   # or yarn install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:

   **For Development Mode (Recommended for getting started):**
   ```env
   # Development Mode - No Auth, No Billing, No Database Setup Required
   NEXT_PUBLIC_APP_MODE=development

   # Valyu API (Required)
   VALYU_API_KEY=valyu_your_api_key_here

   # Mapbox Configuration (Required)
   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_access_token_here

   # App URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   **For Production Mode:**
   ```env
   # Production Mode
   NEXT_PUBLIC_APP_MODE=production
   NEXT_PUBLIC_APP_URL=https://yourdomain.com

   # Valyu API
   VALYU_API_KEY=valyu_your_api_key_here

   # Mapbox
   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_access_token_here

   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

   # Polar Billing (Optional)
   POLAR_ACCESS_TOKEN=polar_your_access_token_here
   POLAR_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   POLAR_SUBSCRIPTION_PRODUCT_ID=prod_your_subscription_product_id_here
   POLAR_PAY_PER_USE_PRODUCT_ID=prod_your_pay_per_use_product_id_here
   ```

4. **Run the development server**
   ```bash
   pnpm dev
   # or npm run dev
   # or yarn dev
   ```

5. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

6. **Start exploring**

   - Click anywhere on the globe to research that location
   - Use the "Random Location" button to discover somewhere new
   - Watch the AI research unfold in real-time

## How to Use

### Basic Usage

1. **Navigate the Globe**
   - Drag to rotate
   - Scroll to zoom in/out
   - The globe auto-rotates when idle

2. **Research a Location**
   - Click on any country, city, island, or geographical feature
   - A popup will show the location name
   - The research interface opens automatically

3. **Watch the Research**
   - See the AI's reasoning process
   - View tool calls (web searches, database queries)
   - See sources being discovered in real-time

4. **Review Results**
   - Read the comprehensive historical analysis
   - Click on source citations to verify information
   - View images and visual aids (if available)

5. **Save for Later** (signed-in users)
   - Your research is automatically saved
   - Access past research from the sidebar
   - Share research via shareable URLs

### Advanced Features

- **Random Discovery**: Click "Random Location" to explore a random place on Earth
- **Map Styles**: Switch between satellite, streets, and other map styles (signed-in users)
- **Reasoning View**: Click to see the detailed reasoning trace of the AI
- **Dark Mode**: Automatically matches your system preferences

## Development Modes

History has two operating modes to make development easy:

### Development Mode (Default for Local Development)
```env
NEXT_PUBLIC_APP_MODE=development
```

**Features:**
- No Supabase required - uses local SQLite
- No authentication needed - auto-login as dev user
- Unlimited queries - no rate limits
- No billing integration
- Works completely offline (except API calls)
- Perfect for contributing and testing

### Production Mode
```env
NEXT_PUBLIC_APP_MODE=production
```

**Features:**
- Full authentication with Supabase
- Billing integration with Polar
- Rate limiting based on user tiers
- Cloud database storage
- Analytics and tracking

## Rate Limits & Billing

### Anonymous Users
- **1 query (lifetime)** - No account required
- After first query, prompted to sign up

### Free Users (Signed Up)
- **3 queries per day** - Resets at midnight
- Full access to research history
- Save and share research

### Subscription Plan ($20/month)
- **100 queries per month** - Approximately $0.20 per query
- 1 week free trial included
- Priority support
- Resets on the 1st of each month

### Pay-Per-Use Plan
- **$0.25 per query** - Unlimited usage
- No monthly commitment
- Only pay for what you use
- Billed via Polar usage metering

## Getting API Keys

### Valyu API (Required)

1. Go to [platform.valyu.ai](https://platform.valyu.ai)
2. Sign up for a free account
3. Navigate to API Keys
4. Create a new API key
5. Add it to `.env.local` as `VALYU_API_KEY`

**Pricing:**
- Free tier available for testing
- Pay-as-you-go pricing for production
- Lite model: approximately $0.10 per research
- Heavy model: approximately $0.50 per research

### Mapbox Access Token (Required)

1. Go to [mapbox.com](https://account.mapbox.com)
2. Sign up for a free account
3. Create a new access token
4. Add it to `.env.local` as `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`

**Pricing:**
- 50,000 free map loads per month
- Additional usage billed per load (very affordable)

### Polar Setup (Optional - For Billing)

1. Go to [polar.sh](https://polar.sh)
2. Create an account
3. Set up two products:
   - **Subscription Product**: $20/month recurring
   - **Pay-Per-Use Product**: Usage-based billing
4. Create a meter for pay-per-use:
   - Event name: `deep_research`
   - Aggregation: `count`
   - Pricing: $0.25 per unit
5. Add product IDs and webhook secret to `.env.local`

## Database Schema

History uses a minimal database schema optimized for the DeepResearch API:

### `users`
```sql
- id: UUID (primary key)
- email: text
- avatar_url: text
- subscription_tier: enum (free, pay_per_use, subscription)
- subscription_status: enum (active, inactive)
- polar_customer_id: text
- subscription_id: text
- created_at: timestamp
- updated_at: timestamp
```

### `research_tasks`
```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to users)
- deepresearch_id: text (Valyu API task ID)
- location_name: text
- location_lat: float
- location_lng: float
- location_images: jsonb
- status: enum (queued, running, completed, failed)
- anonymous_id: text
- is_public: boolean
- share_token: text
- shared_at: timestamp
- created_at: timestamp
- updated_at: timestamp
- completed_at: timestamp
```

### `user_rate_limits`
```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to users)
- usage_count: integer
- reset_date: text
- monthly_usage_count: integer
- monthly_reset_date: text
- last_request_at: timestamp
- created_at: timestamp
- updated_at: timestamp
```

**Note:** Full research content is stored in Valyu's DeepResearch API. We only store metadata and task IDs, keeping the database lean and avoiding duplication.

## Contributing

History is fully open-source. Contributions are welcome and appreciated.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test in development mode (`NEXT_PUBLIC_APP_MODE=development`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Areas for Contribution

- Additional map styles and visualizations
- Location bookmarking and collections
- Image galleries for historical locations
- Mobile app optimizations
- Multi-language support
- Data visualizations (timelines, charts)
- Advanced search and filtering
- Accessibility improvements

## Who This Is For

If you also spend hours clicking random islands on Google Maps, you'll understand why this needed to exist.

Perfect for:
- People who doomscroll maps like me
- History researchers who need quick location context
- Travel planners researching destinations
- Students learning world geography
- Anyone curious about literally any place on Earth

## Known Issues & Limitations

- Mapbox free tier limited to 50k loads/month
- DeepResearch API calls cost money (though very reasonable)
- Globe performance may be slower on older devices
- Some remote locations may have limited historical data

## License

This project is open-source and available under the MIT License.

## Support & Questions

- **Issues**: [Open an issue](https://github.com/yorkeccak/history/issues) on GitHub
- **Discussions**: [Join the discussion](https://github.com/yorkeccak/history/discussions)
- **Hosted Version**: Try it at [history.valyu.ai](https://history.valyu.ai)

## Roadmap

Future features under consideration:

- Timeline visualization with historical events
- Multiple locations comparison
- Historical image galleries from archives
- PDF export of research reports
- Collaborative research sharing
- Location bookmarks and collections
- Advanced filters (time periods, topics, event types)
- Mobile app versions (iOS, Android)
- Offline mode with cached research
- 3D historical recreations
- AR view for mobile devices

## Inspiration & Acknowledgments

This project was born from countless hours spent exploring Google Maps, clicking on random islands, mountains, and remote places at 2am, and wanting to know their stories. Special thanks to:

- **[Valyu](https://valyu.ai)** - For building an incredible DeepResearch API that makes this possible
- **[Mapbox](https://mapbox.com)** - For beautiful, performant globe visualization
- **[Supabase](https://supabase.com)** - For making authentication and databases simple
- **[Polar](https://polar.sh)** - For developer-friendly billing
- **The Geography Community** - For inspiring curiosity about our planet

---

**Built for geography enthusiasts, history buffs, map doomscrollers, and curious minds everywhere.**

*Explore. Discover. Learn.*
