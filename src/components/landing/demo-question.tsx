// src/components/landing/demo-question.tsx
'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, X, ExternalLink } from "lucide-react"
import QuestionSkeleton from "./skeletons/demo-question-skeleton"
import Image from 'next/image';

interface Option {
  id: string;
  text: string;
  correct: boolean;
}

interface Question {
  title: string;
  body: string;
  image: string;
  options: Option[];
  teachingPoint: string;
  incorrectExplanations: Record<string, string>;
  references: string[];
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
        title: "Head & Neck Pathology",
        body: "A 32-year-old woman presents with a slowly growing, non-tender mass in the right parotid gland that has been present for approximately 8 months. Physical examination reveals a 2.5 cm mobile, well-circumscribed mass. CT imaging shows a well-defined lesion without infiltrative growth or lymphadenopathy. The patient undergoes a superficial parotidectomy. An image is shown below.\n\nWhich of the following is the MOST likely fusion product found in this neoplasm?",
        image: "https://www.pathologyoutlines.com/imgau/salivaryglandsMECasiry17.jpg",
        options: [
          { id: 'a', text: "EWSR1-ATF1", correct: false },
          { id: 'b', text: "LIFR-PLAG1", correct: false },
          { id: 'c', text: "HMGA2-NFIB", correct: false },
          { id: 'd', text: "CRTC1-MAML2", correct: true },
          { id: 'e', text: "ETV6-NR4A3", correct: false }
        ],
        teachingPoint: "CRTC1-MAML2 is the characteristic fusion found in approximately 55-75% of mucoepidermoid carcinomas (MECs). The histologic features in this case - including mucin-containing cells, intermediate cells, and well-formed cystic spaces - are classic for MEC. This fusion is associated with low to intermediate-grade tumors and better prognosis.",
        incorrectExplanations: {
          'a': "EWSR1-ATF1: This fusion is characteristic of hyalinizing clear cell carcinoma of salivary glands, which typically shows sheets of monomorphic cells with clear cytoplasm, distinct cell borders, and hyalinized stroma.",
          'b': "LIFR-PLAG1: This fusion is found in pleomorphic adenomas, which typically show a biphasic pattern with epithelial/myoepithelial cells in a chondromyxoid stroma.",
          'c': "HMGA2-NFIB: This fusion is also commonly found in pleomorphic adenomas.",
          'e': "ETV6-NR4A3: This fusion is characteristic of acinic cell carcinomas, which typically show the typical zymogen granules, basophilic cytoplasm, and acinar architecture."
        },
        references: [
          "https://www.pathologyoutlines.com/topic/salivaryglandsMEC.html",
          "Toper MH, Sarioglu S. Molecular pathology of salivary gland neoplasms: diagnostic, prognostic, and predictive perspective. Adv Anat Pathol. 2021;28(2):81–93."
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

        <div className={`relative rounded-lg overflow-hidden border transform transition-all duration-500 delay-200 ${
          showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}>
          <Image
            src={question.image}
            alt="Pathology specimen"
            width={500}
            height={300}
            priority={true}
            className="w-full h-40 object-cover object-center"
          />
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

              {/* Molecular Genetics Table */}
              <div>
                <h4 className="font-medium text-xs uppercase mb-1">Molecular Genetics of Salivary Gland Tumors</h4>
                <div className="space-y-2">
                  <div className="max-w-full overflow-hidden">
                    <Image
                      src="https://www.captodayonline.com/wordpress/wp-content/uploads/2021/08/CytoTable_1.gif"
                      alt="Table showing characteristic genetic changes in salivary gland neoplasms"
                      width={500}
                      height={300}
                      priority={true}
                      className="max-w-full h-auto"
                      style={{ maxWidth: '100%' }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground italic">
                    Source: Toper MH, Sarioglu S. Molecular pathology of salivary gland neoplasms: diagnostic, prognostic, and predictive perspective. Adv Anat Pathol. 2021;28(2):81–93. Reprinted with permission.
                  </div>
                </div>
              </div>

              {/* Incorrect Explanations */}
              <div>
                <h4 className="font-medium text-xs uppercase mb-1">Incorrect Answer Explanations</h4>
                <div className="space-y-2 text-muted-foreground">
                  {Object.entries(question.incorrectExplanations)
                    .filter(([id]) => selectedOption && !question.options.find(opt => opt.id === id)?.correct)
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
                      <a href={ref} target="_blank" rel="noopener noreferrer" 
                         className="hover:underline truncate">
                        {ref}
                      </a>
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