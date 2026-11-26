/**
 * Dr. Albright's jokes — a curated list, not model output: every one is read
 * before it ships, nothing off-colour can slip out, and a joke costs no
 * tokens. Rules for adding one: short, clean, pathology-flavoured, and never
 * at the expense of patients, illness, death or any group of people.
 */
export const JOKES: readonly string[] = [
  "Why don't mitotic figures ever finish an argument? They always split.",
  "What do you call a granuloma with low self-esteem? Poorly formed.",
  "Why is the Reed–Sternberg cell invited to every party? Those owl eyes make it the life of the infiltrate.",
  "Pathologists don't make mistakes. We issue addenda.",
  "Why do frozen sections never panic? They stay cool under pressure.",
  "Why did the slide book a therapy session? Too many unresolved artifacts.",
  "Why is Ki-67 so popular? It's always proliferating.",
  "Why don't histiocytes ever get lonely? When things get tough, they fuse into a giant cell.",
  "Why did the cell skip the party? It was in G0 and just not feeling it.",
  "What's a pathologist's favourite board game? Clue — it's all about finding the cause.",
  'How do you know a pathologist is really sure? The report doesn\'t say "cannot be entirely excluded."',
  "Why did the psammoma body win the talent show? Its layered performance was hard to top.",
  'How does a pathologist apologise? "In retrospect, my differential was too narrow."',
  'What did the H&E say to the immunostain? "I see you\'ve brought receipts."',
  "Why did the cytopathologist turn down the date? Not enough cellularity for an adequate assessment.",
  "Why are eosinophils great at brunch? They always bring the granules.",
  "What's a neuron's favourite way to stay in touch? Synapse-chat.",
  "Why did the margin refuse to commit? It wanted to stay negative.",
  "Why do pathologists love autumn? Everything turns a lovely shade of eosin.",
  "Why did the B cell get promoted? Outstanding class switching.",
  "What do you call a signet ring cell that won't stop talking about itself? Mucin-centric.",
  "Why was the tissue so calm in the processor? It had been thoroughly dehydrated and cleared of all worries.",
];

/** Short invitations back to pathology, rotated so the reply doesn't read the same each time. */
const INVITES = [
  "Got a pathology question for me?",
  "Now — what shall we look at?",
  "Right, back to the microscope: what's your question?",
];

/** One joke and an invitation (`random` is injectable for tests). */
export function jokeAnswer(random: () => number = Math.random): string {
  const joke = JOKES[Math.floor(random() * JOKES.length) % JOKES.length];
  const invite = INVITES[Math.floor(random() * INVITES.length) % INVITES.length];
  return `${joke} ${invite}`;
}
