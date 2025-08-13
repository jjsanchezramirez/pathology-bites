// src/shared/utils/repository.ts

// Derive repository name from slide ID prefix (client-side)
export function getRepositoryFromId(id: string): string {
  if (!id) return 'Unknown'
  if (id.startsWith('hemepath_')) return 'Hematopathology eTutorial'
  if (id.startsWith('leeds_')) return 'Leeds University'
  if (id.startsWith('pathpresenter_')) return 'PathPresenter'
  if (id.startsWith('mgh_')) return 'MGH Pathology'
  if (id.startsWith('toronto_')) return 'University of Toronto LMP'
  if (id.startsWith('rosai_')) return 'Rosai Collection'
  if (id.startsWith('recutclub_')) return 'Recut Club'
  return 'Unknown'
}

