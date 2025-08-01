// src/features/questions/utils/display-helpers.ts

export function getCategoryPathString(category: any, categoryPaths: Map<number, any>): string {
  const path = [];
  let current = category;
  
  while (current) {
    path.unshift(current.name);
    current = current.parent_id ? categoryPaths.get(current.parent_id) : null;
  }
  
  return path.join(' > ');
}

/**
 * Extracts the short form from a name with format "Full Name (Short)"
 * Returns the short form if found, otherwise returns the full name
 * @deprecated Use the short_form column from the database instead
 */
export function extractShortForm(name: string): string {
  const match = name.match(/\(([^)]+)\)$/);
  return match ? match[1] : name;
}

/**
 * Gets the display name for categories in table badges (short form)
 * Uses the short_form field if available, otherwise falls back to extracting from name
 */
export function getCategoryDisplayName(category: { name: string; short_form?: string }): string {
  return category.short_form || extractShortForm(category.name);
}

/**
 * Gets the display name for question sets in table badges (short form)
 * Uses the short_form field if available, otherwise falls back to extracting from name
 */
export function getQuestionSetDisplayName(questionSet: { name: string; short_form?: string }): string {
  return questionSet.short_form || extractShortForm(questionSet.name);
}
