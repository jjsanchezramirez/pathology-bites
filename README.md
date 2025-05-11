# Pathology Bites

![Pathology Bites](https://github.com/pathology-bites/pathology-bites/raw/main/public/images/logo.png)

Pathology Bites is an open educational resource providing free, high-quality pathology learning materials for medical students, residents, and practicing pathologists. Our interactive question bank offers comprehensive practice across all major pathology subspecialties.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0.4-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0.0-black)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.3.0-38B2AC)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-2.39.0-3ECF8E)](https://supabase.io/)

## 🔍 Features

- **Comprehensive Question Bank**: Hundreds of expertly curated pathology questions
- **Interactive Learning**: Case-based scenarios with high-quality pathology images
- **Performance Tracking**: Detailed analytics to identify strengths and areas for improvement
- **Subspecialty Coverage**: Content across surgical pathology, cytopathology, hematopathology, and more
- **Board Preparation**: Questions aligned with current board examination formats
- **Mobile Responsive**: Learn on any device, anywhere

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0.0 or later
- npm or yarn
- Git

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/pathology-bites/pathology-bites.git
   cd pathology-bites
   ```

2. Install dependencies:
   ```
   npm install
   # or
   yarn install
   ```

3. Set up environment variables:
   ```
   cp .env.example .env.local
   ```
   Update the environment variables in `.env.local` with your Supabase credentials.

4. Start the development server:
   ```
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## 🛠️ Technology Stack

- **Frontend Framework**: [Next.js](https://nextjs.org/) with App Router
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) with [Tailwind CSS](https://tailwindcss.com/)
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
│   │   ├── api/           # API endpoints
│   ├── components/        # React components
│   │   ├── admin/         # Admin interface components
│   │   ├── auth/          # Authentication components
│   │   ├── dashboard/     # Dashboard components
│   │   ├── images/        # Image-related components
│   │   ├── landing/       # Landing page components
│   │   ├── layout/        # Layout components
│   │   ├── questions/     # Question-related components
│   │   ├── ui/            # Base UI components (shadcn/ui)
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions
│   │   ├── auth/          # Authentication utilities
│   │   ├── images/        # Image processing utilities
│   │   ├── network/       # Network status utilities
│   │   ├── supabase/      # Supabase client utilities
│   ├── styles/            # Global CSS
│   ├── types/             # TypeScript type definitions
│   ├── middleware.ts      # Next.js middleware
├── .env.example           # Example environment variables
├── next.config.js         # Next.js configuration
├── package.json           # Project dependencies
├── tailwind.config.js     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
```

## 🧪 Development & Testing

### Code Style

This project follows a strict code style. Run the linter to ensure your code follows the project standards:

```
npm run lint
# or
yarn lint
```

### Testing

Run the test suite with:

```
npm run test
# or
yarn test
```

To run tests in watch mode:

```
npm run test:watch
# or
yarn test:watch
```

## 🚢 Deployment

The application is configured for easy deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Set up the required environment variables
3. Deploy!

For other platforms, build the production version:

```
npm run build
# or
yarn build
```

## 💻 Admin Access

For admin access to manage content and users:

1. Create a regular user account
2. Use the Supabase Dashboard to update the user's role to 'admin'
3. Access the admin dashboard at `/admin/dashboard`

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