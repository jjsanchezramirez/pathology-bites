// src/shared/data/faq-data.tsx
import React from "react";

export interface FAQItem {
  value: string;
  question: string;
  answer: string | React.ReactNode;
}

export interface FAQCategory {
  title: string;
  items: FAQItem[];
}

export const faqData: FAQCategory[] = [
  {
    title: "General",
    items: [
      {
        value: "what-is",
        question: "What is PathologyBites?",
        answer:
          "A completely FREE pathology education platform powered by AI, offering a comprehensive question bank and learning tools for pathology education.",
      },
      {
        value: "who-for",
        question: "Who is PathologyBites for?",
        answer:
          "Medical students, residents, fellows, and practicing pathologists looking to enhance their knowledge.",
      },
      {
        value: "email-req",
        question: "Do I need an institutional email to sign up?",
        answer:
          "No! You can sign up with any email address. We do require an email to track your progress and provide personalized recommendations.",
      },
    ],
  },
  {
    title: "Content & Quality",
    items: [
      {
        value: "content-generation",
        question: "How is your content generated?",
        answer: (
          <>
            <p className="mb-4">
              Our questions are generated through an advanced AI large language model (LLM)
              specifically trained on comprehensive pathology literature, including peer-reviewed
              journals and authoritative texts. We strictly adhere to the American Board of
              Pathology (ABP) AP/CP Board Exam content specifications to ensure our material covers
              all high-yield topics.
            </p>
            <p>
              Every piece of content undergoes rigorous verification by our expert pathology faculty
              before publication. This innovative AI-driven approach, combined with expert
              oversight, enables us to maintain exceptional educational quality while keeping
              PathologyBites completely free for all users.
            </p>
          </>
        ),
      },
      {
        value: "images",
        question: "What about the photographs and diagrams?",
        answer: (
          <>
            <p className="mb-4">
              We use high-quality images from our own collection and trusted sources like
              PathologyOutlines and Wikimedia Commons. All sources are clearly credited alongside
              each image.
            </p>
            <p>
              Feel free to use any content from PathologyBites for educational purposes, as long as
              proper attribution is provided. We believe in open education and knowledge sharing
              within the pathology community.
            </p>
          </>
        ),
      },
      {
        value: "updates",
        question: "How often is content updated?",
        answer:
          "We regularly revise questions based on user feedback and updates in the field. We greatly appreciate user feedback to help maintain content accuracy and relevance.",
      },
    ],
  },
  {
    title: "Technical & Support",
    items: [
      {
        value: "mobile",
        question: "Can I use PathologyBites on mobile devices?",
        answer:
          "Coming soon! We're developing native mobile apps for both Android and iOS devices. In the meantime, you can access PathologyBites through your mobile browser for a fully responsive experience.",
      },
      {
        value: "progress",
        question: "Is my progress saved if I lose internet connection?",
        answer: "Yes, all progress is automatically saved and syncs when your connection resumes.",
      },
      {
        value: "feedback",
        question: "How can I report issues or suggest improvements?",
        answer:
          "Through our contact form. We value your feedback and use it to continuously improve the platform.",
      },
    ],
  },
  {
    title: "Institutional",
    items: [
      {
        value: "partnership",
        question: "Can my institution partner with PathologyBites?",
        answer:
          "We're excited to partner with institutions! Contact us to discuss how we can work together to support your educational goals.",
      },
      {
        value: "analytics",
        question: "Are institutional analytics available?",
        answer: (
          <>
            <p className="mb-4">
              For interested institutions, we offer comprehensive analytics features that allow
              program directors to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Track resident performance and progress across all pathology domains</li>
              <li>Identify knowledge gaps at individual and group levels</li>
              <li>Monitor study patterns and engagement metrics</li>
              <li>Generate detailed reports for competency assessments</li>
              <li>Compare anonymous aggregate data with national benchmarks</li>
            </ul>
            <p className="mt-4">
              Contact us to learn more about implementing these features for your program.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: "Cost & Participation",
    items: [
      {
        value: "cost",
        question: "Is PathologyBites really free?",
        answer:
          "Yes! PathologyBites is completely free. Our AI-powered approach allows us to maintain high quality while eliminating costs. If you're interested in contributing or participating in our development, please reach out.",
      },
    ],
  },
  {
    title: "Study Strategy",
    items: [
      {
        value: "board-prep",
        question: "How should I use PathologyBites to prepare for boards?",
        answer: (
          <div className="space-y-4">
            <p>We recommend a systematic approach:</p>
            <ul className="list-decimal pl-6 space-y-2">
              <li>Take a general practice test to identify knowledge gaps</li>
              <li>Focus on weak areas using our targeted quizzes</li>
              <li>Practice daily, even if only for a few minutes</li>
              <li>Review explanations thoroughly, even for correct answers</li>
              <li>Review wrong answers and take notes on key concepts</li>
              <li>Track your progress with our analytics dashboard</li>
              <li>Join our Discord group!</li>
            </ul>
            <p>Remember: Consistent practice over time is more effective than cramming.</p>
          </div>
        ),
      },
    ],
  },
  {
    title: "Important Disclaimers",
    items: [
      {
        value: "content-disclaimer",
        question: "Content Ownership & Third-Party Links",
        answer: (
          <>
            <p className="mb-4">
              Our Virtual Slide Search Engine provides links to third-party whole slide image (WSI)
              repositories. We do not host, store, or claim ownership of any of the content linked.
              All copyrights remain with the respective content owners.
            </p>
            <p>
              Accessing and using external content is subject to each source's terms and conditions.
              No affiliation or endorsement is implied between PathologyBites and the linked
              repositories.
            </p>
          </>
        ),
      },
      {
        value: "medical-disclaimer",
        question: "Medical & Educational Disclaimer",
        answer: (
          <>
            <p className="mb-4">
              PathologyBites is an educational platform intended for learning purposes only and does
              not constitute medical advice, diagnosis, or treatment recommendations. The content
              provided should not be used as a substitute for professional medical judgment or
              clinical decision-making.
            </p>
            <p>
              Always consult qualified healthcare professionals for medical decisions, patient care,
              and diagnostic interpretations. Users are responsible for verifying information and
              applying appropriate clinical judgment in their practice.
            </p>
          </>
        ),
      },
    ],
  },
];
