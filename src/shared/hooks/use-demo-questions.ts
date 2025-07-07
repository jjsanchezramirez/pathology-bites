// src/hooks/use-demo-questions.ts
import { useState, useEffect } from 'react';

export interface Option {
  id: string;
  text: string;
  correct: boolean;
  explanation?: string;
}

export interface QuestionImage {
  url: string;
  caption?: string;
  alt: string;
}

export interface Question {
  id: string;
  title: string;
  body: string;
  images: QuestionImage[];
  options: Option[];
  teachingPoint: string;
  incorrectExplanations: Record<string, string>;
  references: string[];
  comparativeImage?: QuestionImage;
}

export function useDemoQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchNewQuestion = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use current index for sequential ordering
      const response = await fetch(`/api/demo-questions?index=${currentIndex}`);

      if (!response.ok) {
        // If 404, fall back to hardcoded question instead of throwing error
        if (response.status === 404) {
          console.log('No demo questions in database, using fallback question');
          // Fall through to the fallback question logic below
        } else {
          throw new Error(`Failed to fetch demo question: ${response.status}`);
        }
      } else {
        const data = await response.json();

        if (data && data.id) {
          setCurrentQuestion(data);
          // Update current index for next question
          if (data._metadata?.nextIndex !== undefined) {
            setCurrentIndex(data._metadata.nextIndex);
          }
          // Add to questions array if not already present
          setQuestions(prev => {
            const exists = prev.some(q => q.id === data.id);
            if (!exists) {
              return [...prev, data];
            }
            return prev;
          });
          return; // Successfully loaded from API, exit function
        } else {
          console.log('Invalid question data received, using fallback question');
          // Fall through to the fallback question logic below
        }
      }
    } catch (err) {
      console.error('Error fetching demo question:', err);
      console.log('Using fallback question due to error');
      // Fall through to the fallback question logic below
    }

    // Fallback to hardcoded question when API fails or no demo questions available
    try {
      console.log('Loading fallback demo question');
      const fallbackQuestion: Question = {
        id: 'demo-fallback',
        title: "Lymph Node Pathology",
        body: "A 25-year-old woman presents with an enlarged cervical lymph node that has been slowly growing over the past year. She denies fever, night sweats, or weight loss. Physical examination reveals a single, mobile 3 cm lymph node. CT imaging shows no other lymphadenopathy. The lymph node is excised, and histologic images are shown below.\n\nWhich of the following is the MOST likely diagnosis based on the histologic features?",
        images: [
          {
            url: "https://htsnkuudinrcgfqlqmpi.supabase.co/storage/v1/object/public/images//1740220846343-castleman-disease-hyaline-vascular-variant-onion-skinning.png",
            caption: "Histologic section showing concentric 'onion-skinning' of mantle zone lymphocytes around atrophic germinal center.",
            alt: "Castleman disease - onion skinning pattern"
          },
          {
            url: "https://htsnkuudinrcgfqlqmpi.supabase.co/storage/v1/object/public/images//1740198745969-castleman-disease-hyaline-vascular-variant-lolly-popping.png",
            caption: "Histologic section showing penetrating hyalinized vessel creating 'lollipop' appearance.",
            alt: "Castleman disease - lollipop pattern"
          },
          {
            url: "https://htsnkuudinrcgfqlqmpi.supabase.co/storage/v1/object/public/images//1740220868115-castleman-disease-hyaline-vascular-variant-twinning.png",
            caption: "Histologic section showing twinning of follicles with hyalinized vessels.",
            alt: "Castleman disease - twinning pattern"
          }
        ],
        options: [
          { id: 'a', text: "Reactive follicular hyperplasia", correct: false },
          { id: 'b', text: "Hyaline vascular Castleman disease", correct: true },
          { id: 'c', text: "Nodular lymphocyte predominant Hodgkin lymphoma", correct: false },
          { id: 'd', text: "Progressive transformation of germinal centers", correct: false },
          { id: 'e', text: "Angioimmunoblastic T-cell lymphoma", correct: false }
        ],
        teachingPoint: "The histologic features are classic for hyaline vascular Castleman disease (HV-CD), showing characteristic 'onion-skinning' of mantle zone lymphocytes around regressed/hyalinized germinal centers with penetrating hyalinized vessels ('lollipop' follicles). This is the most common variant of unicentric Castleman disease, typically presenting as a single enlarged lymph node in young adults. The presence of these features in a single lymph node without systemic symptoms strongly supports the diagnosis of unicentric HV-CD.",
        incorrectExplanations: {
          'a': "Reactive follicular hyperplasia shows expanded germinal centers with preserved architecture, tingible body macrophages, and a normal mantle zone without the characteristic 'onion-skinning' seen here.",
          'c': "Nodular lymphocyte predominant Hodgkin lymphoma shows large abnormal lymphocytes ('popcorn cells') in a nodular background of small lymphocytes, without the hyalinized vessels or onion-skinning pattern seen here.",
          'd': "Progressive transformation of germinal centers shows large nodules composed of small mantle cells with scattered germinal center remnants, but lacks the hyalinized vessels and concentric mantle cell layering characteristic of HV-CD.",
          'e': "Angioimmunoblastic T-cell lymphoma typically shows effaced architecture with prominent arborizing high endothelial venules, polymorphous infiltrate, and expanded follicular dendritic cell meshwork, features not seen in this case."
        },
        comparativeImage: {
          url: "https://htsnkuudinrcgfqlqmpi.supabase.co/storage/v1/object/public/images/Screenshot%202025-02-19%20at%2012.20.58%20AM.png",
          caption: "Comparison of different Castleman disease variants showing key clinical and pathologic features.",
          alt: "Castleman disease variants comparison chart"
        },
        references: [
          "Liu AY, Nabel CS, Finkelman BS, et al. Idiopathic multicentric Castleman's disease: a systematic literature review. Lancet Haematol. 2016;3(4):e163-e175.",
          "https://pubmed.ncbi.nlm.nih.gov/32106302/"
        ]
      };

      setCurrentQuestion(fallbackQuestion);
      setQuestions([fallbackQuestion]);
      setError(null); // Clear any previous errors since we have a fallback question
    } catch (fallbackError) {
      console.error('Error loading fallback question:', fallbackError);
      setError('Failed to load demo question');
    } finally {
      setLoading(false);
    }
  };

  const refreshQuestion = () => {
    // Move to next question in sequence
    fetchNewQuestion();
  };

  // Initial load
  useEffect(() => {
    fetchNewQuestion();
  }, []);
  
  return {
    questions,
    currentQuestion,
    loading,
    error,
    refreshQuestion
  };
}