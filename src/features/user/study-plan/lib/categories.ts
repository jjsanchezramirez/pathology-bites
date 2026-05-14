export interface Category {
  id: string;
  name: string;
  parent: "CP" | "AP";
}

export const CATEGORIES: Category[] = [
  // Clinical Pathology
  { id: "cp-blood-bank", name: "Blood Banking/Transfusion Medicine", parent: "CP" },
  { id: "cp-chemistry", name: "Clinical Chemistry", parent: "CP" },
  { id: "cp-coagulation", name: "Coagulation", parent: "CP" },
  { id: "cp-hematopathology", name: "Hematopathology", parent: "CP" },
  { id: "cp-immunology", name: "Immunology", parent: "CP" },
  { id: "cp-informatics", name: "Informatics", parent: "CP" },
  { id: "cp-lab-management", name: "Lab Management & Medical Directorship", parent: "CP" },
  { id: "cp-microbiology", name: "Medical Microbiology", parent: "CP" },
  { id: "cp-molecular", name: "Molecular Pathology & Cytogenetics", parent: "CP" },
  // Anatomic Pathology
  { id: "ap-bone-soft-tissue", name: "Bone & Soft Tissue", parent: "AP" },
  { id: "ap-breast", name: "Breast", parent: "AP" },
  { id: "ap-cytopathology", name: "Cytopathology", parent: "AP" },
  { id: "ap-dermatopathology", name: "Dermatopathology", parent: "AP" },
  { id: "ap-endocrine", name: "Endocrine & Neuroendocrine", parent: "AP" },
  { id: "ap-forensics", name: "Forensics & Autopsy", parent: "AP" },
  { id: "ap-gi", name: "Gastrointestinal", parent: "AP" },
  { id: "ap-gu", name: "Genitourinary", parent: "AP" },
  { id: "ap-gyn", name: "Gynecologic", parent: "AP" },
  { id: "ap-head-neck", name: "Head & Neck", parent: "AP" },
  { id: "ap-liver", name: "Liver", parent: "AP" },
  { id: "ap-neuropathology", name: "Neuropathology", parent: "AP" },
  { id: "ap-pancreatobiliary", name: "Pancreatobiliary", parent: "AP" },
  { id: "ap-pediatric", name: "Pediatric", parent: "AP" },
  { id: "ap-placental", name: "Placental", parent: "AP" },
  { id: "ap-thoracic", name: "Thoracic", parent: "AP" },
];

export const CP_CATEGORIES = CATEGORIES.filter((c) => c.parent === "CP");
export const AP_CATEGORIES = CATEGORIES.filter((c) => c.parent === "AP");

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function getCategoryParent(id: string): "CP" | "AP" | undefined {
  return getCategoryById(id)?.parent;
}
