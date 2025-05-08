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

  const getRandomQuestion = () => {
    if (questions.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * questions.length);
    return questions[randomIndex];
  };

  // Function to reload a random question
  const refreshQuestion = () => {
    setLoading(true);
    // Short delay to show loading state for better UX
    setTimeout(() => {
      setCurrentQuestion(getRandomQuestion());
      setLoading(false);
    }, 800);
  };

  // Fetch questions from API
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        
        // Hardcoded demo question for development 
        const demoQuestion: Question = {
          id: 'demo-1',
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
        
        setQuestions([demoQuestion]);
        setCurrentQuestion(demoQuestion);
        setLoading(false);
        
        // Comment out the API call for now until the endpoint is ready
        /*
        // Once you have the API endpoint working, uncomment this:
        try {
          const response = await fetch('/api/demo-questions');
          
          if (!response.ok) {
            throw new Error('Failed to fetch demo questions');
          }
          
          const data = await response.json();
          
          if (data && data.length > 0) {
            setQuestions(data);
            setCurrentQuestion(getRandomQuestion());
          }
        } catch (fetchError) {
          console.error('API fetch error:', fetchError);
          // Still use the hardcoded question as fallback
        }
        */
      } catch (err) {
        console.error('Error in use-demo-questions hook:', err);
        setError(err instanceof Error ? err.message : 'Failed to load questions');
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestions();
  }, []);
  
  return {
    questions,
    currentQuestion,
    loading,
    error,
    refreshQuestion
  };
}