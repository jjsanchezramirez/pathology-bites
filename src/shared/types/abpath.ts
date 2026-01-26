// ABPath Content Specifications Type Definitions

export interface ABPathMetadata {
  total_sections: number;
  ap_sections: number;
  cp_sections: number;
  last_updated: string;
  data_source?: string;
}

export interface ABPathContentSpecifications {
  ap_sections: ABPathSection[];
  cp_sections: ABPathSection[];
}

export interface ABPathSection {
  section: number;
  title: string;
  type: "ap" | "cp";
  items?: ABPathItem[];
  subsections?: ABPathSubsection[];
  line?: number;
  note?: string;
}

export interface ABPathSubsection {
  number?: number;
  letter?: string;
  title: string;
  line?: number;
  items?: ABPathItem[];
  sections?: ABPathSubSection[];
}

export interface ABPathSubSection {
  title: string;
  line?: number;
  items?: ABPathItem[];
}

export interface ABPathItem {
  number?: number;
  letter?: string;
  roman?: string;
  title: string;
  designation?: string;
  line?: number;
  note?: string;
  subitems?: ABPathItem[];
}

export interface ABPathData {
  content_specifications: ABPathContentSpecifications;
  metadata: ABPathMetadata;
}
