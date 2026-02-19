export interface ImageInput {
  url: string;
  title: string;
  description: string;
  category: string; // "microscopic" | "gross" | "figure" | "table" | undefined
  /** Microscopic magnification level — guides annotation strategy */
  magnification?: "low" | "medium" | "high" | "very_high" | null;
  width: number;
  height: number;
}
