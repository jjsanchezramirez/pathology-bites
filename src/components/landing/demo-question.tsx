// src/components/landing/demo-question.tsx
'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, X, ExternalLink } from "lucide-react"
import QuestionSkeleton from "./skeletons/demo-question-skeleton"
import { ImageCarousel } from "@/components/images/image-carousel"

interface Option {
  id: string;
  text: string;
  correct: boolean;
}

interface QuestionImage {
  url: string;
  caption: string;
  alt: string;
}

interface Question {
  title: string;
  body: string;
  images: QuestionImage[];
  options: Option[];
  teachingPoint: string;
  incorrectExplanations: Record<string, string>;
  references: string[];
  comparativeImage: QuestionImage;
}

function DemoQuestion() {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [question, setQuestion] = useState<Question | null>(null);
  const [showContent, setShowContent] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuestion({
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
      });
      setIsLoading(false);
      setTimeout(() => setShowContent(true), 100);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const handleOptionClick = (optionId: string) => {
    if (!isAnswered) {
      setSelectedOption(optionId);
      setIsAnswered(true);
      setTimeout(() => setShowExplanation(true), 300);
    }
  };

  const resetQuestion = () => {
    setShowContent(false);
    setShowExplanation(false);
    setIsLoading(true);
    setSelectedOption(null);
    setIsAnswered(false);
    setTimeout(() => {
      setIsLoading(false);
      setTimeout(() => setShowContent(true), 100);
    }, 2000);
  };

  if (isLoading || !question) return <QuestionSkeleton />;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="py-2">
        <CardTitle className={`text-lg transform transition-all duration-500 ${
          showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}>
          {question.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`text-sm text-foreground/90 transform transition-all duration-500 delay-100 ${
          showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}>
          {question.body}
        </div>

        {/* Image Carousel */}
        <div className={`transform transition-all duration-500 delay-200 ${
          showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}>
          <ImageCarousel images={question.images} />
          <div className="mt-1 text-xs text-muted-foreground">
            {question.images[0].caption}
          </div>
        </div>

        <div className="grid gap-2">
          {question.options.map((option, index) => {
            const isSelected = selectedOption === option.id;
            const showCorrect = isAnswered && option.correct;
            const showIncorrect = isAnswered && isSelected && !option.correct;

            return (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.id)}
                className={`
                  p-2 rounded-md text-left border text-sm transition-all duration-500
                  transform ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
                  ${!isAnswered ? 'hover:border-primary/50 hover:bg-primary/5' : ''}
                  ${isSelected ? 'border-primary' : 'border-border'}
                  ${showCorrect ? 'bg-green-50 border-green-500 dark:bg-green-950/30' : ''}
                  ${showIncorrect ? 'bg-red-50 border-red-500 dark:bg-red-950/30' : ''}
                `}
                style={{ transitionDelay: `${300 + index * 100}ms` }}
                disabled={isAnswered}
              >
                <div className="flex items-center gap-2">
                  <span className={`
                    flex items-center justify-center w-5 h-5 rounded-full border text-xs
                    ${isSelected ? 'border-primary' : 'border-muted-foreground/30'}
                    ${showCorrect ? 'border-green-500' : ''}
                    ${showIncorrect ? 'border-red-500' : ''}
                  `}>
                    {option.id.toUpperCase()}
                  </span>
                  <span className="flex-1">{option.text}</span>
                  {showCorrect && <Check className="w-4 h-4 text-green-500" />}
                  {showIncorrect && <X className="w-4 h-4 text-red-500" />}
                </div>
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className={`transform transition-all duration-500 ${
            showExplanation ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}>
            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-4">
              {/* Teaching Point */}
              <div>
                <h4 className="font-medium text-xs uppercase mb-1">Teaching Point</h4>
                <div className="text-muted-foreground">
                  {question.teachingPoint}
                </div>
              </div>

              {/* Comparative Image */}
              <div>
                <h4 className="font-medium text-xs uppercase mb-1">Reference Chart</h4>
                <div className="bg-white rounded-lg border overflow-hidden">
                  <ImageCarousel 
                    images={[question.comparativeImage]} 
                    className="m-0 max-w-full"
                  />
                  <div className="p-2 text-xs text-muted-foreground">
                    {question.comparativeImage.caption}
                  </div>
                </div>
              </div>

              {/* Incorrect Explanations */}
              <div>
                <h4 className="font-medium text-xs uppercase mb-1">Incorrect Answer Explanations</h4>
                <div className="space-y-2 text-muted-foreground">
                  {Object.entries(question.incorrectExplanations)
                    .filter(([id]) => selectedOption !== id && id !== 'b') // Filter out the selected option and the correct answer (b)
                    .map(([id, explanation]) => (
                      <div key={id} className="flex gap-2">
                        <span className="font-medium">{id.toUpperCase()}.</span>
                        <span>{explanation}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* References */}
              <div className="text-xs text-muted-foreground">
                <h4 className="font-medium uppercase mb-1">References</h4>
                <ul className="space-y-1">
                  {question.references.map((ref, index) => (
                    <li key={index} className="flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      <span className="truncate">
                        {ref}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end pt-2">
                <Button 
                  onClick={resetQuestion}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Try Another
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DemoQuestion;