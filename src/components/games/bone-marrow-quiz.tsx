// src/components/games/cell-identification-game.tsx
'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, X, BookOpen, Brain, ChevronRight, ArrowRight, RefreshCw } from "lucide-react"
import Image from 'next/image'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue
} from "@/components/ui/select"

interface CellOption {
  id: string; // A, B, C, D
  text: string;
  correct: boolean;
}

interface CellQuestion {
  cellType: string;
  imagePath: string;
  options: CellOption[];
  description: string;
  keyFeatures: string[];
}

// Define cell types with descriptions and lineage groups
const CELL_TYPES = {
  // Myeloid lineage
  blast: { 
    name: "Blast", 
    lineage: "myeloid",
    description: "The earliest identifiable cell of the granulocytic series. Large cell with fine nuclear chromatin, nucleoli, and basophilic cytoplasm without granules.",
    keyFeatures: [
      "Large cell (15-20μm)",
      "Round/oval nucleus with fine chromatin",
      "2-5 nucleoli",
      "Basophilic cytoplasm with no specific granules",
      "High nuclear-to-cytoplasmic ratio"
    ]
  },
  promyelocyte: { 
    name: "Promyelocyte", 
    lineage: "myeloid",
    description: "Early myeloid precursor characterized by primary (azurophilic) granules in the cytoplasm.",
    keyFeatures: [
      "Larger than myeloblast",
      "Round nucleus with slightly clumped chromatin",
      "Nucleoli may be visible",
      "Prominent primary (azurophilic) granules",
      "Golgi zone (clear area near nucleus)"
    ]
  },
  myelocyte: { 
    name: "Myelocyte", 
    lineage: "myeloid",
    description: "Developing granulocyte with round to oval nucleus and specific secondary granules in cytoplasm.",
    keyFeatures: [
      "Round to oval nucleus",
      "Condensed chromatin",
      "No visible nucleoli",
      "Specific secondary granules present (pink in neutrophilic myelocytes)",
      "No nuclear indentation"
    ]
  },
  metamyelocyte: { 
    name: "Metamyelocyte", 
    lineage: "myeloid",
    description: "Developing granulocyte with kidney-shaped (indented) nucleus. No longer capable of division.",
    keyFeatures: [
      "Kidney-shaped (indented) nucleus",
      "Condensed chromatin",
      "Abundant specific granules",
      "More mature than myelocyte",
      "No longer capable of division"
    ]
  },
  band: { 
    name: "Band Neutrophil", 
    lineage: "myeloid",
    description: "Immature neutrophil with a curved, band-shaped nucleus. Precursor to the segmented neutrophil.",
    keyFeatures: [
      "Curved, band-shaped nucleus without segmentation",
      "Nuclear width relatively uniform",
      "Condensed chromatin",
      "Pink cytoplasm with specific granules"
    ]
  },
  segmented: { 
    name: "Segmented Neutrophil", 
    lineage: "myeloid",
    description: "Mature neutrophil with a multi-lobed nucleus connected by thin filaments. Most common white blood cell in circulation.",
    keyFeatures: [
      "Multi-lobed nucleus (3-5 lobes)",
      "Lobes connected by thin filaments",
      "Condensed chromatin",
      "Pink cytoplasm with specific granules",
      "Most numerous leukocyte in peripheral blood"
    ]
  },
  eosinophil: { 
    name: "Eosinophil", 
    lineage: "myeloid",
    description: "Granulocyte with bright orange-red granules. Involved in allergic reactions and parasitic infections.",
    keyFeatures: [
      "Bi-lobed nucleus",
      "Large, uniform, orange-red granules",
      "Granules contain crystalloid core",
      "Functions in allergic reactions and parasite defense"
    ]
  },
  basophil: { 
    name: "Basophil", 
    lineage: "myeloid",
    description: "Granulocyte with large, dark blue-purple granules that often obscure the nucleus. Functions in allergic and inflammatory reactions.",
    keyFeatures: [
      "Large, dark purple-blue granules",
      "Granules may obscure the nucleus",
      "Bi-lobed nucleus (often difficult to see)",
      "Least common granulocyte in peripheral blood"
    ]
  },
  
  // Erythroid lineage
  proerythroblast: { 
    name: "Proerythroblast", 
    lineage: "erythroid",
    description: "Earliest recognizable erythroid precursor with large nucleus and deeply basophilic cytoplasm.",
    keyFeatures: [
      "Large cell with round nucleus",
      "Fine nuclear chromatin",
      "1-2 nucleoli",
      "Deeply basophilic cytoplasm",
      "Perinuclear halo (Golgi zone)"
    ]
  },
  basophilic: { 
    name: "Basophilic Erythroblast", 
    lineage: "erythroid",
    description: "Early erythroid precursor with deep blue cytoplasm due to high RNA content.",
    keyFeatures: [
      "Smaller than proerythroblast",
      "Dense, coarse chromatin pattern",
      "No nucleoli",
      "Deeply basophilic (blue) cytoplasm",
      "High N:C ratio"
    ]
  },
  polychromatic: { 
    name: "Polychromatic Erythroblast", 
    lineage: "erythroid",
    description: "Mid-stage erythroid precursor with blue-pink (polychromatic) cytoplasm as hemoglobin accumulates.",
    keyFeatures: [
      "Smaller than basophilic erythroblast",
      "Dense, clumped nuclear chromatin",
      "Polychromatic (blue-pink) cytoplasm",
      "Hemoglobin synthesis ongoing"
    ]
  },
  orthochromatic: { 
    name: "Orthochromatic Erythroblast", 
    lineage: "erythroid",
    description: "Late erythroid precursor with small, pyknotic nucleus and pink-orange (orthochromatic) cytoplasm.",
    keyFeatures: [
      "Small cell",
      "Small, dense, pyknotic nucleus",
      "Predominantly pink-orange cytoplasm",
      "Last nucleated stage of erythroid development",
      "Nucleus eventually extruded"
    ]
  },
  
  // Lymphoid/other cells
  lymphocyte: { 
    name: "Lymphocyte", 
    lineage: "lymphoid",
    description: "Small to medium-sized cell with round nucleus and scant cytoplasm. Key cell of the adaptive immune system.",
    keyFeatures: [
      "Round, densely stained nucleus",
      "High nuclear-to-cytoplasmic ratio",
      "Thin rim of blue cytoplasm",
      "Condensed, clumped chromatin",
      "May show small indentation"
    ]
  },
  plasma: { 
    name: "Plasma Cell", 
    lineage: "lymphoid",
    description: "Antibody-producing cell derived from B lymphocytes with eccentric nucleus, clock-face chromatin, and basophilic cytoplasm with a perinuclear clear zone.",
    keyFeatures: [
      "Eccentric nucleus",
      "Clock-face chromatin pattern",
      "Abundant deep blue cytoplasm",
      "Perinuclear clear zone (Golgi apparatus)",
      "Antibody-producing cell"
    ]
  },
  monocyte: { 
    name: "Monocyte", 
    lineage: "monocytic",
    description: "Largest leukocyte with abundant light blue-gray cytoplasm and an irregularly shaped nucleus. Precursor to tissue macrophages.",
    keyFeatures: [
      "Large cell (15-20μm)",
      "Abundant gray-blue cytoplasm",
      "Irregular, indented, or folded nucleus",
      "Fine, lacy chromatin",
      "May contain fine azurophilic granules"
    ]
  },
  macrophage: { 
    name: "Macrophage", 
    lineage: "monocytic",
    description: "Large phagocytic cell with abundant cytoplasm that may contain ingested material. Derived from monocytes that have migrated into tissues.",
    keyFeatures: [
      "Very large cell",
      "Abundant cytoplasm",
      "May contain phagocytosed material",
      "Oval or kidney-shaped nucleus",
      "May have vacuolated appearance"
    ]
  }
};

// Group cell types by lineage
const CELL_GROUPS = {
  all: {
    name: "All Cells",
    cells: Object.keys(CELL_TYPES)
  },
  myeloid: {
    name: "Myeloid Maturation",
    cells: Object.keys(CELL_TYPES).filter(key => CELL_TYPES[key].lineage === "myeloid")
  },
  erythroid: {
    name: "Erythroid Maturation",
    cells: Object.keys(CELL_TYPES).filter(key => CELL_TYPES[key].lineage === "erythroid")
  },
  lymphoid: {
    name: "Lymphoid & Other",
    cells: Object.keys(CELL_TYPES).filter(key => 
      CELL_TYPES[key].lineage === "lymphoid" || 
      CELL_TYPES[key].lineage === "monocytic" ||
      CELL_TYPES[key].lineage === "other"
    )
  },
  common: {
    name: "Common Cells",
    cells: ['lymphocyte', 'monocyte', 'segmented', 'eosinophil', 'basophil']
  }
};

function CellIdentificationGame() {
  // Game state
  const [mode, setMode] = useState<'learn' | 'quiz'>('learn');
  const [cellGroup, setCellGroup] = useState<string>('common');
  const [selectedCellType, setSelectedCellType] = useState<string | null>(null);
  
  // Question state
  const [isLoading, setIsLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<CellQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  // When cell group changes, reset selected cell
  useEffect(() => {
    setSelectedCellType(null);
  }, [cellGroup]);
  
  // When mode or selected cell type changes, generate new content
  useEffect(() => {
    if (mode === 'learn' && selectedCellType) {
      loadLearningContent(selectedCellType);
    } else if (mode === 'quiz') {
      loadQuizQuestion();
    }
  }, [mode, selectedCellType, cellGroup]);

  // Initial load
  useEffect(() => {
    if (mode === 'learn') {
      // Start with the first cell in the group for learning mode
      const firstCell = CELL_GROUPS[cellGroup].cells[0];
      setSelectedCellType(firstCell);
    } else {
      loadQuizQuestion();
    }
  }, []);

  // Load learning content for a specific cell type
  const loadLearningContent = (cellType: string) => {
    setIsLoading(true);
    setShowContent(false);
    setShowExplanation(false);
    
    // Short delay for visual effect
    setTimeout(() => {
      // Generate a random image index (0-3 for this example)
      const imageIndex = Math.floor(Math.random() * 4);
      const paddedIndex = String(imageIndex).padStart(3, '0');
      
      // Create the image path
      const imagePath = `/images/cells/${cellType}_${paddedIndex}.png`;
      
      // Create a question object for display consistency
      const newQuestion: CellQuestion = {
        cellType,
        imagePath,
        options: [], // No options needed in learn mode
        description: CELL_TYPES[cellType].description,
        keyFeatures: CELL_TYPES[cellType].keyFeatures
      };
      
      setCurrentQuestion(newQuestion);
      setIsLoading(false);
      setShowContent(true);
      setShowExplanation(true); // Always show explanation in learn mode
    }, 300); // Reduced delay for better responsiveness
  };

  // Load a quiz question
  const loadQuizQuestion = () => {
    setIsLoading(true);
    setShowContent(false);
    setShowExplanation(false);
    setSelectedOption(null);
    setIsAnswered(false);

    // Shorter delay for better responsiveness
    setTimeout(() => {
      // Get available cell types for current group
      const availableCells = CELL_GROUPS[cellGroup].cells;
      
      // Randomly select a cell type
      const cellType = availableCells[Math.floor(Math.random() * availableCells.length)];
      
      // Generate a random image index (0-3 for this example)
      const imageIndex = Math.floor(Math.random() * 4);
      const paddedIndex = String(imageIndex).padStart(3, '0');
      
      // Create the image path
      const imagePath = `/images/cells/${cellType}_${paddedIndex}.png`;
      
      // Create options (1 correct, 3 incorrect)
      const correctOption = {
        id: 'A', // Will be placed in appropriate position later
        text: CELL_TYPES[cellType].name,
        correct: true
      };
      
      // Get incorrect options (other cell types from same group)
      const otherCellTypes = availableCells.filter(t => t !== cellType);
      const shuffledIncorrectTypes = otherCellTypes.sort(() => Math.random() - 0.5).slice(0, 3);
      
      // Create options with consistent IDs
      const allOptions = [
        { ...correctOption, id: 'A' },
        { id: 'B', text: CELL_TYPES[shuffledIncorrectTypes[0]].name, correct: false },
        { id: 'C', text: CELL_TYPES[shuffledIncorrectTypes[1]].name, correct: false },
        { id: 'D', text: CELL_TYPES[shuffledIncorrectTypes[2]].name, correct: false }
      ].sort(() => Math.random() - 0.5);
      
      // Reassign consistent IDs after shuffling (A, B, C, D in order)
      const optionsWithConsistentIds = allOptions.map((opt, index) => ({
        ...opt,
        id: ['A', 'B', 'C', 'D'][index]
      }));
      
      // Create the question
      const newQuestion: CellQuestion = {
        cellType,
        imagePath,
        options: optionsWithConsistentIds,
        description: CELL_TYPES[cellType].description,
        keyFeatures: CELL_TYPES[cellType].keyFeatures
      };
      
      setCurrentQuestion(newQuestion);
      setIsLoading(false);
      setShowContent(true);
      
      // Update question count in quiz mode
      if (mode === 'quiz') {
        setQuestionCount(prev => prev + 1);
      }
    }, 300); // Reduced delay for better responsiveness
  };

  // Handle option selection in quiz mode
  const handleOptionClick = (optionId: string) => {
    if (!isAnswered && currentQuestion) {
      setSelectedOption(optionId);
      setIsAnswered(true);
      
      // Find selected option
      const selectedOption = currentQuestion.options.find(opt => opt.id === optionId);
      if (selectedOption && selectedOption.correct) {
        setScore(prev => prev + 1);
      }
      
      // Show explanation with slight delay
      setTimeout(() => setShowExplanation(true), 300);
    }
  };

  // Navigate to next cell in learning mode
  const handleNextCell = () => {
    if (mode === 'learn' && selectedCellType) {
      const currentCells = CELL_GROUPS[cellGroup].cells;
      const currentIndex = currentCells.indexOf(selectedCellType);
      const nextIndex = (currentIndex + 1) % currentCells.length;
      setSelectedCellType(currentCells[nextIndex]);
    } else if (mode === 'quiz') {
      loadQuizQuestion();
    }
  };

  // Navigate to previous cell in learning mode
  const handlePreviousCell = () => {
    if (mode === 'learn' && selectedCellType) {
      const currentCells = CELL_GROUPS[cellGroup].cells;
      const currentIndex = currentCells.indexOf(selectedCellType);
      const prevIndex = (currentIndex - 1 + currentCells.length) % currentCells.length;
      setSelectedCellType(currentCells[prevIndex]);
    }
  };

  // Skip current question in quiz mode
  const handleSkip = () => {
    if (mode === 'quiz' && !isAnswered) {
      loadQuizQuestion();
    }
  };

  // Switch mode between learn and quiz
  const handleModeChange = (newMode: 'learn' | 'quiz') => {
    setMode(newMode);
    if (newMode === 'quiz') {
      setScore(0);
      setQuestionCount(0);
      loadQuizQuestion();
    } else {
      // In learn mode, select the first cell of current group
      const firstCell = CELL_GROUPS[cellGroup].cells[0];
      setSelectedCellType(firstCell);
    }
  };

  // Switch cell group
  const handleGroupChange = (newGroup: string) => {
    setCellGroup(newGroup);
    if (mode === 'learn') {
      // In learn mode, select the first cell of new group
      const firstCell = CELL_GROUPS[newGroup].cells[0];
      setSelectedCellType(firstCell);
    } else {
      // In quiz mode, load a new question from the new group
      loadQuizQuestion();
    }
  };

  // Loading state
  if (isLoading || !currentQuestion) {
    return (
      <Card className="w-full max-w-6xl mx-auto">
        <CardHeader className="py-2">
          <CardTitle className="text-lg">Cell Identification</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center min-h-[300px]">
          <div className="animate-pulse flex flex-col items-center space-y-6">
            <div className="rounded-lg bg-muted h-64 w-64"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="space-y-2 w-full">
              <div className="h-10 bg-muted rounded"></div>
              <div className="h-10 bg-muted rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader className="py-2 flex flex-row items-center justify-between">
        <CardTitle className={`text-lg transform transition-all duration-500 ${
          showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}>
          Cell Identification {mode === 'quiz' ? 'Challenge' : 'Learning'}
        </CardTitle>
        
        <div className="flex items-center gap-4">
          {/* Mode selector */}
          <div className="flex items-center rounded-md bg-muted p-1">
            <button
              onClick={() => handleModeChange('learn')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                mode === 'learn' 
                  ? 'bg-background shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                <span>Learn</span>
              </div>
            </button>
            <button
              onClick={() => handleModeChange('quiz')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                mode === 'quiz' 
                  ? 'bg-background shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-1">
                <Brain className="h-3.5 w-3.5" />
                <span>Quiz</span>
              </div>
            </button>
          </div>
          
          {/* Cell group selector */}
          <Select 
            value={cellGroup} 
            onValueChange={handleGroupChange}
          >
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Select cell group" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CELL_GROUPS).map(([key, group]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Score indicator (quiz mode only) */}
          {mode === 'quiz' && (
            <div className="text-sm text-muted-foreground">
              Score: {score}/{questionCount}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Horizontal layout with image on left, content on right */}
        <div className={`flex flex-col md:flex-row gap-6 transform transition-all duration-500 ${
          showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}>
          {/* Left side - Cell image */}
          <div className="flex-shrink-0 w-full md:w-[300px]">
            <div className="relative rounded-lg overflow-hidden border h-[300px] w-full">
              <Image
                src={currentQuestion.imagePath}
                alt={`${CELL_TYPES[currentQuestion.cellType].name} cell`}
                fill
                priority={true}
                className="object-contain"
                onError={(e) => {
                  e.currentTarget.src = 'https://via.placeholder.com/300x300?text=Cell+Image+(Placeholder)';
                }}
              />
            </div>
            
            {/* Cell type indicator in learn mode */}
            {mode === 'learn' && (
              <div className="mt-3 text-center">
                <h3 className="font-semibold text-lg">{CELL_TYPES[currentQuestion.cellType].name}</h3>
                <p className="text-sm text-muted-foreground">
                  {CELL_TYPES[currentQuestion.cellType].lineage.charAt(0).toUpperCase() + 
                   CELL_TYPES[currentQuestion.cellType].lineage.slice(1)} Lineage
                </p>
              </div>
            )}
          </div>
          
          {/* Right side - Questions in quiz mode, description in learn mode */}
          <div className="flex-1 flex flex-col">
            {mode === 'quiz' ? (
              <>
                <h3 className="text-sm font-medium mb-3">
                  Identify the bone marrow cell shown in the image:
                </h3>
                
                {/* Quiz options */}
                <div className="grid gap-2 mb-4">
                  {currentQuestion.options.map((option) => {
                    const isSelected = selectedOption === option.id;
                    const showCorrect = isAnswered && option.correct;
                    const showIncorrect = isAnswered && isSelected && !option.correct;

                    return (
                      <button
                        key={option.id}
                        onClick={() => handleOptionClick(option.id)}
                        className={`
                          p-2 rounded-md text-left border text-sm transition-all duration-300
                          ${!isAnswered ? 'hover:border-primary/50 hover:bg-primary/5' : ''}
                          ${isSelected ? 'border-primary' : 'border-border'}
                          ${showCorrect ? 'bg-green-50 border-green-500 dark:bg-green-950/30' : ''}
                          ${showIncorrect ? 'bg-red-50 border-red-500 dark:bg-red-950/30' : ''}
                        `}
                        disabled={isAnswered}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`
                            flex items-center justify-center w-5 h-5 rounded-full border text-xs
                            ${isSelected ? 'border-primary' : 'border-muted-foreground/30'}
                            ${showCorrect ? 'border-green-500' : ''}
                            ${showIncorrect ? 'border-red-500' : ''}
                          `}>
                            {option.id}
                          </span>
                          <span className="flex-1">{option.text}</span>
                          {showCorrect && <Check className="w-4 h-4 text-green-500" />}
                          {showIncorrect && <X className="w-4 h-4 text-red-500" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                
                {/* Skip button */}
                {!isAnswered && (
                  <div className="flex justify-end mb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs flex items-center gap-1 text-muted-foreground"
                      onClick={handleSkip}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Skip
                    </Button>
                  </div>
                )}
              </>
            ) : (
              // Learning mode navigation
              <div className="flex justify-between items-center mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousCell}
                  className="text-xs"
                >
                  Previous Cell
                </Button>
                
                {cellGroup !== 'all' && (
                  <Select 
                    value={selectedCellType || ''}
                    onValueChange={setSelectedCellType}
                  >
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue placeholder="Select cell type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CELL_GROUPS[cellGroup].cells.map((cellType) => (
                        <SelectItem key={cellType} value={cellType} className="text-xs">
                          {CELL_TYPES[cellType].name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextCell}
                  className="text-xs"
                >
                  Next Cell
                </Button>
              </div>
            )}
            
            {/* Cell explanation - Always visible in learn mode, conditional in quiz mode */}
            {(mode === 'learn' || showExplanation) && (
              <div className={`p-3 rounded-lg bg-muted/50 text-sm space-y-4 ${
                mode === 'quiz' ? 'transform transition-all duration-500' : ''
              } ${
                mode === 'quiz' && showExplanation ? 'translate-y-0 opacity-100' : 
                mode === 'quiz' ? 'translate-y-4 opacity-0' : ''
              }`}>
                {/* Cell description */}
                <div>
                  <h4 className="font-medium text-xs uppercase mb-1">Description</h4>
                  <div className="text-muted-foreground">
                    {currentQuestion.description}
                  </div>
                </div>

                {/* Key Features */}
                <div>
                  <h4 className="font-medium text-xs uppercase mb-1">Key Identifying Features</h4>
                  <ul className="text-muted-foreground list-disc pl-5 space-y-1">
                    {currentQuestion.keyFeatures.map((feature, index) => (
                      <li key={index}>{feature}</li>
                    ))}
                  </ul>
                </div>

                {/* Next question button in quiz mode */}
                {mode === 'quiz' && isAnswered && (
                  <div className="flex justify-end pt-2">
                    <Button 
                      onClick={loadQuizQuestion}
                      size="sm"
                      className="text-xs flex items-center gap-1"
                    >
                      Next Question
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            {/* Quiz-to-Learn transition button */}
            {mode === 'quiz' && isAnswered && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs flex items-center justify-center gap-1"
                  onClick={() => {
                    setMode('learn');
                    setSelectedCellType(currentQuestion.cellType);
                  }}
                >
                  <BookOpen className="h-3 w-3" />
                  Learn more about this cell type
                </Button>
              </div>
            )}
            
            {/* Learn-to-Quiz transition button */}
            {mode === 'learn' && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs flex items-center justify-center gap-1"
                  onClick={() => {
                    setMode('quiz');
                    loadQuizQuestion();
                  }}
                >
                  <Brain className="h-3 w-3" />
                  Test your knowledge
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CellIdentificationGame;