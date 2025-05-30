# Pathology Bites

![Pathology Bites](https://github.com/pathology-bites/pathology-bites/raw/main/public/images/logo.png)

Pathology Bites is an open educational resource providing free, high-quality pathology learning materials for medical students, residents, and practicing pathologists. Our interactive question bank offers comprehensive practice across all major pathology subspecialties.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0.4-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0.0-black)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0.0-38B2AC)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-2.39.0-3ECF8E)](https://supabase.io/)

## 🔍 Features

- **Comprehensive Question Bank**: Expertly curated pathology questions across subspecialties
- **Interactive Learning**: Case-based scenarios with high-quality pathology images
- **Performance Tracking**: Detailed analytics to identify strengths and areas for improvement
- **Subspecialty Coverage**: Content across surgical pathology, cytopathology, hematopathology, and more
- **Board Preparation**: Questions aligned with current board examination formats
- **Mobile Responsive**: Learn on any device, anywhere
- **Offline Support**: Access content even without an internet connection

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0.0 or later
- npm or yarn
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/pathology-bites/pathology-bites.git
   cd pathology-bites
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Update the environment variables in `.env.local` with your Supabase credentials.

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## 🛠️ Technology Stack

- **Frontend Framework**: [Next.js](https://nextjs.org/) with App Router
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) with [Tailwind CSS v4](https://tailwindcss.com/)
- **Authentication & Backend**: [Supabase](https://supabase.io/)
- **Form Handling**: [React Hook Form](https://react-hook-form.com/) with [Zod](https://github.com/colinhacks/zod) validation
- **Image Processing**: [Compressor.js](https://fengyuanchen.github.io/compressorjs/)
- **Deployment**: [Vercel](https://vercel.com/)

## 📂 Project Structure

```
pathology-bites/
├── public/                 # Static assets
├── src/
│   ├── app/                # Next.js App Router routes
│   │   ├── (admin)/       # Admin section routes
│   │   ├── (auth)/        # Authentication routes
│   │   ├── (dashboard)/   # User dashboard routes
│   │   ├── (public)/      # Public-facing routes
│   │   └── api/           # API endpoints
│   ├── features/           # Feature modules
│   │   ├── auth/          # Authentication feature
│   │   │   ├── components/# Auth-specific components
│   │   │   ├── hooks/     # Auth-specific hooks
│   │   │   ├── services/  # Auth API calls
│   │   │   ├── types/     # Auth types
│   │   │   └── index.ts   # Feature exports
│   │   ├── questions/     # Questions feature
│   │   ├── images/        # Image management feature
│   │   ├── users/         # User management feature
│   │   └── dashboard/     # Dashboard feature
│   ├── shared/            # Shared across features
│   │   ├── components/    # Reusable UI components
│   │   │   ├── ui/       # Base UI components (shadcn/ui)
│   │   │   ├── layout/   # Layout components
│   │   │   └── common/   # Common components
│   │   ├── hooks/        # Shared hooks
│   │   ├── services/     # Shared services
│   │   ├── types/        # Shared types
│   │   ├── utils/        # Utility functions
│   │   └── constants/    # App constants
│   └── styles/           # Global CSS
├── postcss.config.js     # PostCSS configuration
├── tailwind.config.ts    # Tailwind CSS configuration
└── ... (other config files)
```

## 💻 Key Features in Detail

### Question Bank

The platform offers a comprehensive pathology question bank:

- **Diverse Question Types**: Multiple-choice, image-based, and case studies
- **Difficulty Levels**: Questions ranging from beginner to advanced
- **Detailed Explanations**: Comprehensive teaching points for each question
- **References**: Citations to relevant literature and resources
- **Tags & Categories**: Organized by subspecialty, topic, and system

### Image Viewer

Our specialized image viewer for pathology specimens includes:

- **High-Resolution Support**: View detailed pathology images
- **Zoom & Pan**: Navigate through high-magnification slides
- **Annotations**: View labeled regions of interest
- **Side-by-side Comparison**: Compare gross and microscopic findings

### Quiz System

The interactive quiz system features multiple learning modes:

- **Test Mode**: Timed assessment with performance metrics
- **Tutor Mode**: Immediate feedback after each question
- **Study Mode**: Review questions with full explanations visible

### Analytics Dashboard

Detailed performance tracking helps users identify areas for improvement:

- **Performance Metrics**: Track accuracy, speed, and improvement
- **Knowledge Gap Analysis**: Identify weaker subspecialties
- **Progress Over Time**: Visualize learning progress
- **Peer Comparison**: Anonymous benchmarking against peers

## 🧪 Development

### Code Style

This project follows strict code style. Run the linter to ensure your code follows the project standards:

```bash
npm run lint
# or
yarn lint
```

### Testing

Run the test suite with:

```bash
npm run test
# or
yarn test
```

### Working with Tailwind CSS v4

This project uses Tailwind CSS v4 with its updated syntax:

- Color opacity uses the `-50%` format instead of `/50` (e.g., `bg-blue-500-50%`)
- Arbitrary properties use the `--` prefix (e.g., `[--mask-type:luminance]`)
- Note that preflight (CSS reset) is now separate from `@tailwind base`

## 🚢 Deployment

### Deploying to Vercel via Terminal

1. Install the Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Log in to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   # For preview deployment
   vercel

   # For production deployment
   vercel --prod
   ```

## 👥 Contributing

We welcome contributions to Pathology Bites! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) file for details on our code of conduct and the process for submitting pull requests.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact

For questions or feedback, reach out to us at:

- Email: support@pathologybites.com
- Twitter: [@PathologyBites](https://twitter.com/PathologyBites)

## 🙏 Acknowledgments

- All the medical professionals who contributed content
- The open-source community for the amazing tools and libraries
- Our users for valuable feedback and suggestions

---

Made with ❤️ by the Pathology Bites team