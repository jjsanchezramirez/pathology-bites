/**
 * The site guide: how-to answers about Pathology Bites itself ("how do I flag
 * a question?", "how do I build a study plan?"), served by Dr. Albright with
 * no model call.
 *
 * Why a curated list and not RAG: the internal docs site is developer
 * documentation (infrastructure, API reference) behind a password, and the
 * FAQ has no feature how-tos — the missing piece was the content, not the
 * retrieval. At ~25 entries, keyword matching (like the entity matcher) finds
 * the right one; a vector index would add cost and nothing else.
 *
 * Every step and label here was checked against the UI code (Nov 2026). When
 * a page's labels change, change its entry — a wrong how-to is worse than
 * none. Links are in-site paths only (the card renders `[label](/path)`).
 */
import { normalizeQuestion } from "./router";

export interface GuideEntry {
  id: string;
  title: string;
  /** The page the entry is about (cited as the source). */
  href: string;
  /**
   * Phrases that pick this entry, matched as whole words in the lowercased
   * question. Site-specific on purpose: "cell counter", never "count cells" —
   * a pathology question must not be answered with a how-to.
   */
  phrases: string[];
  /** The reply: short Markdown bullets, in-site links allowed. */
  answer: string;
  /** How a user would ask for this entry: offered as a follow-up from related entries. */
  ask: string;
  /** Ids of entries to offer as follow-up questions. */
  related?: string[];
}

export const SITE_GUIDE: GuideEntry[] = [
  {
    id: "create-quiz",
    ask: "How do I create a quiz?",
    title: "Create a quiz",
    href: "/dashboard/quiz/new",
    phrases: [
      "create a quiz",
      "create quiz",
      "make a quiz",
      "start a quiz",
      "new quiz",
      "build a quiz",
      "set up a quiz",
      "quiz settings",
      "quiz options",
      "tutor mode",
      "practice mode",
      "timed quiz",
      "untimed",
      "how many questions",
      "quiz categories",
      "ap only",
      "cp only",
      "unused questions",
      "needs review",
    ],
    answer:
      "Open [New Quiz](/dashboard/quiz/new) (sidebar → Practice), then:\n- **Number of Questions:** 5, 10, 25 or 50, or the slider (up to 50).\n- **Mode:** **Tutor** shows the answer and explanation after each question; **Practice** saves explanations for the review at the end.\n- **Timing:** **Timed** (about 60 seconds per question overall) or **Untimed**.\n- **Question Type:** All, Unused, Needs Review (missed before), Marked or Mastered.\n- **Categories:** All, AP Only, CP Only, or **Custom** to pick specific ones.\n- Click **Start Quiz**.\nYour defaults can be set in [Settings](/dashboard/settings) → Quiz Settings.",
    related: ["take-quiz", "my-quizzes"],
  },
  {
    id: "take-quiz",
    ask: "How do I skip a question?",
    title: "Take a quiz",
    href: "/dashboard/quizzes",
    phrases: [
      "take a quiz",
      "taking a quiz",
      "answer a question",
      "skip a question",
      "skip question",
      "go back to a question",
      "previous question",
      "strike out",
      "cross out",
      "eliminate an answer",
      "quiz navigation",
      "submit answer",
      "submit my answer",
      "complete quiz",
      "finish a quiz",
      "finish the quiz",
      "submit the quiz",
      "submit quiz",
    ],
    answer:
      "- **Tutor mode:** clicking an option answers it and shows the explanation; use **Skip Question** before answering, **Next** after.\n- **Practice mode:** click an option, then **Submit Answer**; explanations come in the review after the quiz.\n- **Previous** or the **Quiz Navigation** panel jumps between questions (on a phone, the **Navigation** button).\n- **Strike out** an option with its strike icon, or right-click / long-press it.\n- Highlight a term to search images or open an example slide.\n- On the last question, **Complete Quiz** (or **Submit Quiz** if some are unanswered) finishes it.",
    related: ["pause-quiz", "quiz-review"],
  },
  {
    id: "pause-quiz",
    ask: "How do I pause or resume a quiz?",
    title: "Pause, save and resume a quiz",
    href: "/dashboard/quizzes",
    phrases: [
      "pause",
      "pause a quiz",
      "pause the timer",
      "save and exit",
      "save & exit",
      "resume a quiz",
      "resume my quiz",
      "continue a quiz",
      "continue my quiz",
      "finish later",
      "come back later",
      "unfinished quiz",
      "in progress quiz",
      "timer",
      "time's up",
      "ran out of time",
    ],
    answer:
      "- **Pause:** the pause icon in the quiz header stops the timer; **Resume Quiz** carries on.\n- **Save & Exit** (header, wider screens) saves your answers and takes you to [My Quizzes](/dashboard/quizzes).\n- **Resume:** in [My Quizzes](/dashboard/quizzes), the quiz shows **Continue** — it opens where you left off.\n- **Timed quizzes** submit themselves when the time runs out (“Time's Up!”), with the answers you gave.",
    related: ["my-quizzes", "take-quiz"],
  },
  {
    id: "quiz-review",
    ask: "How do I review my quiz results?",
    title: "Results and review",
    href: "/dashboard/quizzes",
    phrases: [
      "quiz results",
      "my results",
      "see results",
      "my score",
      "review my answers",
      "review a quiz",
      "review the quiz",
      "review questions",
      "see explanations",
      "see the explanation",
      "teaching point",
      "which questions i got wrong",
      "wrong answers",
    ],
    answer:
      "- Finishing a quiz opens its **results**: score, Correct / Incorrect, time, **Performance by Category** and **Performance by Question**.\n- **Review Questions** walks through every question with the correct answer, an explanation for each option, a **Teaching Point**, images and references.\n- Later, find any finished quiz in [My Quizzes](/dashboard/quizzes) → **Results** or **Review**.\n- To practise the ones you missed, create a [New Quiz](/dashboard/quiz/new) with Question Type **Needs Review**.",
    related: ["favorites", "flag-question"],
  },
  {
    id: "flag-question",
    ask: "How do I flag a question?",
    title: "Flag a question",
    href: "/dashboard/quizzes",
    phrases: [
      "flag",
      "flag a question",
      "flagging",
      "report a question",
      "report a problem with a question",
      "wrong answer key",
      "incorrect answer",
      "error in a question",
      "mistake in a question",
      "question is wrong",
      "bad question",
      "broken image",
      "image issue",
    ],
    answer:
      "- Click the **flag icon** (“Flag question for review”) in the header, during a quiz or in its review.\n- Pick an **Issue Type** — Incorrect Answer, Unclear Question, Outdated Content, Incorrect Explanations, Image Issue or Other — and add a description if you like.\n- Click **Flag Question**. The editors review every flag.\n- Each question can be flagged once per person.\nFor a problem with the site itself, use [Contact](/contact) → Technical Support.",
    related: ["contact", "quiz-review"],
  },
  {
    id: "favorites",
    ask: "How do I save favorite questions?",
    title: "Favorite questions",
    href: "/dashboard/quizzes",
    phrases: [
      "favorite",
      "favourite",
      "favorites",
      "favourites",
      "bookmark",
      "save a question",
      "saved questions",
      "star a question",
      "star icon",
    ],
    answer:
      "- The **star** adds a question to your favorites. It appears in a quiz's review and on its results page (Performance by Question), not during the quiz itself.\n- Click it again to remove the question.\n- There is no separate favorites page yet.",
    related: ["quiz-review", "create-quiz"],
  },
  {
    id: "my-quizzes",
    ask: "Where is my quiz history?",
    title: "My Quizzes",
    href: "/dashboard/quizzes",
    phrases: [
      "my quizzes",
      "quiz history",
      "past quizzes",
      "previous quizzes",
      "old quizzes",
      "delete a quiz",
      "delete quiz",
      "retake",
      "redo a quiz",
      "repeat a quiz",
    ],
    answer:
      "[My Quizzes](/dashboard/quizzes) (sidebar → Practice) lists every quiz with your totals and average score.\n- Search, filter by status, mode or timing, and sort (e.g. **Incomplete First**).\n- Each card offers **Start Quiz**, **Continue**, or **Results** and **Review**, depending on where it stands.\n- There is no retake button: create a [New Quiz](/dashboard/quiz/new), e.g. with Question Type **Needs Review**.\n- Quizzes can't be deleted, except ones marked “Data Lost”.",
    related: ["create-quiz", "performance"],
  },
  {
    id: "study-plan-setup",
    ask: "How do I build a study plan?",
    title: "Build a study plan",
    href: "/dashboard/study-plan",
    phrases: [
      "study plan",
      "study calendar",
      "study schedule",
      "build a schedule",
      "make a schedule",
      "plan my studying",
      "board prep schedule",
      "exam date",
      "add a phase",
      "study phases",
      "add a resource",
      "study resources",
      "days off",
      "day off",
    ],
    answer:
      "Open [Study Plan](/dashboard/study-plan) (sidebar → Study) and click **Edit Plan** (gear, top right):\n- **Exam Dates:** name your exam and **Add Exam**.\n- **Resources:** **Add Resource** — a book, QBank, video or flashcards — and **Edit Subjects** to list its chapters (with start pages).\n- **Phases:** **Add Phase** with start and end dates, weekday and weekend hours, its resources and the subject order.\n- **Days Off:** mark full or half days off.\n- Click **Generate** to build the daily schedule (this replaces any existing progress).",
    related: ["study-plan-use"],
  },
  {
    id: "study-plan-use",
    ask: "How do I rebalance my study plan?",
    title: "Use your study plan",
    href: "/dashboard/study-plan",
    phrases: [
      "rebalance",
      "rebalance my plan",
      "rebalance my study plan",
      "rebalance the study plan",
      "behind schedule",
      "fell behind",
      "catch up",
      "catch-up day",
      "mark a task",
      "complete a task",
      "check off",
      "today's tasks",
      "study tasks",
    ],
    answer:
      "- [Study Plan](/dashboard/study-plan) has three tabs: **Schedule** (day or week), **Calendar** and **Progress**.\n- Click a task to tick it off.\n- Fell behind? **Edit Plan** → **Rebalance** regenerates everything from today and keeps the work you've completed. (**Generate** starts over and erases progress.)\n- Catch-up days and days off appear in the schedule.",
    related: ["study-plan-setup"],
  },
  {
    id: "wsi-questions",
    ask: "How do slide-based questions work?",
    title: "Slide-Based Questions",
    href: "/dashboard/wsi-questions",
    phrases: [
      "slide-based questions",
      "slide based questions",
      "slide questions",
      "wsi questions",
      "whole slide image questions",
      "whole slide questions",
      "virtual slide questions",
      "slide quiz",
    ],
    answer:
      "[Slide-Based Questions](/dashboard/wsi-questions) (sidebar → Practice) makes a new question from a real whole slide image each time.\n- Choose a **category** and the question types: **Diagnosis**, **IHC** or **Molecular** (at least one).\n- Click **New question**, study the slide, then click an answer — the explanation and **Teaching Point** appear at once.\n- **Full screen** (or press **F**) gives the slide more room.",
    related: ["slide-viewer", "virtual-slides"],
  },
  {
    id: "slide-viewer",
    ask: "How do I use the slide viewer?",
    title: "The slide viewer",
    href: "/dashboard/wsi-questions",
    phrases: [
      "slide viewer",
      "zoom in",
      "zoom out",
      "zoom",
      "pan around",
      "change magnification",
      "magnification presets",
      "rotate the slide",
      "rotate",
      "brightness",
      "brightness and contrast",
      "minimap",
      "screenshot of the slide",
      "take a photo",
      "fullscreen",
      "full screen",
    ],
    answer:
      "- **Drag** to pan; **scroll** or **pinch** to zoom.\n- Buttons: zoom in / out, **Fit to view**, and magnification presets from 1× to 100×.\n- **Rotate** with the dial (double-click resets); **Brightness & contrast** adjusts brightness, contrast and saturation.\n- **Slide info** shows the diagnosis, stain and source; **Related slides** lists more.\n- The camera buttons save a **photo** of the current view or a high-resolution one.\n- **Fullscreen** fills the screen; Esc leaves it.",
    related: ["wsi-questions", "virtual-slides"],
  },
  {
    id: "virtual-slides",
    ask: "How do I search virtual slides?",
    title: "Virtual slide search",
    href: "/tools/virtual-slides",
    phrases: [
      "virtual slides",
      "virtual slide",
      "search slides",
      "search for slides",
      "find slides",
      "find a slide",
      "slide search",
      "whole slide images",
      "digital slides",
      "slide library",
    ],
    answer:
      "- Type a diagnosis in **Search virtual slides…** at the top of any dashboard page; click a match to open it.\n- Press Enter (or **See all in Virtual Slide Search**) for the full [Virtual Slide Search Engine](/tools/virtual-slides): filter by repository, category and organ system, then **View Slide** or **Open in our viewer**.\n- Its **Study** mode deals out a random set of slides to test yourself.\n- No sign-in needed for the search engine.",
    related: ["slide-viewer", "wsi-questions"],
  },
  {
    id: "anki",
    ask: "How do I use the Ankoma deck viewer?",
    title: "Ankoma Deck Viewer",
    href: "/dashboard/anki",
    phrases: ["anki", "ankoma", "flashcards", "flash cards", "deck viewer", "cloze"],
    answer:
      "The [Ankoma Deck Viewer](/dashboard/anki) (sidebar → Study) lets you browse the Ankoma Anki deck on the site.\n- Choose a deck, then a category.\n- **Space** or **Enter** reveals the next cloze and then moves on; ◀ / ▶ change cards. **Shuffle cards** mixes them.\n- It's for review only and doesn't track progress — for spaced repetition, use the official Anki app.",
    related: ["study-plan-setup"],
  },
  {
    id: "cell-counter",
    ask: "How does the cell counter work?",
    title: "Cell Counter",
    href: "/tools/cell-counter",
    phrases: [
      "cell counter",
      "cell counting tool",
      "differential counter",
      "manual differential",
      "count a differential",
      "keyboard counter",
    ],
    answer:
      "[Cell Counter](/tools/cell-counter) (sidebar → Tools; no sign-in needed):\n- Pick a preset — **Peripheral Blood** or **Bone Marrow** — or **Add Cell Type** with its own key.\n- Set a **Count Limit**, click **Start Counting**, then press each cell's key. Backspace or Ctrl+Z undoes.\n- **Save Preset** keeps your setup.\n- **Copy Table (Epic)** or **Copy Plain Text** copies the result into a report.",
    related: ["tools"],
  },
  {
    id: "ihc-panel",
    ask: "How do I use the IHC panel builder?",
    title: "IHC Panel Builder",
    href: "/tools/ihc",
    phrases: [
      "ihc panel builder",
      "panel builder",
      "ihc tool",
      "ihc panel tool",
      "stain panel tool",
    ],
    answer:
      "The [IHC Panel Builder](/tools/ihc) (no sign-in needed) has three modes:\n- **Diagnose:** enter the stains you saw; click a chip to cycle positive / variable / negative, and the list of diagnoses re-ranks as you go.\n- **Differential:** compare 2–3 diagnoses and see which markers separate them best.\n- **Reference:** search a diagnosis for its full IHC profile.\nData comes from the WHO classification, with positivity rates and references.",
    related: ["tools"],
  },
  {
    id: "tools",
    ask: "What free tools are there?",
    title: "Free tools",
    href: "/tools/virtual-slides",
    phrases: [
      "what tools",
      "free tools",
      "site tools",
      "other tools",
      "image gallery",
      "image library",
      "cell identification quiz",
      "cell quiz",
      "bone marrow morphology quiz",
      "lupus anticoagulant interpreter",
      "lupus anticoagulant tool",
      "milan tool",
      "milan gene lookup",
      "genova",
      "abpath",
      "content specifications",
      "citation generator",
      "image converter",
      "tiff",
    ],
    answer:
      "Free tools, no sign-in needed:\n- [Virtual Slide Search](/tools/virtual-slides) and the [Image Gallery](/tools/images).\n- [IHC Panel Builder](/tools/ihc) and the [Cell Counter](/tools/cell-counter).\n- [Cell Identification Quiz](/tools/cell-quiz) for blood and marrow cells.\n- [Lupus Anticoagulant Interpreter](/tools/lupus-anticoagulant).\n- [MILAN](/tools/milan) gene lookup and [GENOVA](/tools/genova) variant classification (AMP/ASCO/CAP 2017).\n- [ABPath Content Specifications](/tools/abpath).\n- [Citation Generator](/tools/citations) and [Image Converter](/tools/image-converter) (TIFF to PNG/JPEG/WebP).",
    related: ["ihc-panel", "cell-counter"],
  },
  {
    id: "performance",
    ask: "Where can I see my performance?",
    title: "Performance analytics",
    href: "/dashboard/performance",
    phrases: [
      "my performance",
      "performance page",
      "performance analytics",
      "analytics",
      "my stats",
      "my statistics",
      "percentile",
      "peer ranking",
      "how am i doing",
      "my progress",
      "track my progress",
      "weak areas",
      "weakest categories",
    ],
    answer:
      "[Performance](/dashboard/performance) (sidebar → Analytics) shows your **percentile** and **peer ranking**, a **Performance Timeline**, a **Category Comparison** chart, an **Activity Calendar** and per-category results.\n- It fills in as you finish quizzes.\n- The separate “My Progress” page is still coming soon.",
    related: ["achievements", "my-quizzes"],
  },
  {
    id: "achievements",
    ask: "How do achievements work?",
    title: "Achievements",
    href: "/dashboard/achievements",
    phrases: ["achievements", "achievement", "badges", "badge", "unlock"],
    answer:
      "[Achievements](/dashboard/achievements) (sidebar → Analytics) shows how many you've unlocked, in groups such as Diagnostic Experience, Perfectionist, Daily Sign-Out, Pattern Recognition, Diagnostic Accuracy and Differential Diagnosis. They unlock as you take quizzes; new ones also appear in the notification bell.",
    related: ["performance"],
  },
  {
    id: "coming-soon",
    ask: "When are learning modules coming?",
    title: "Coming soon",
    href: "/dashboard",
    phrases: ["learning modules", "learning module", "lessons", "coming soon", "my progress page"],
    answer:
      "**Learning Modules** (structured lessons by topic) and **My Progress** are marked **Soon** in the sidebar — they're still being built. Meanwhile, [Performance](/dashboard/performance) tracks your results.",
    related: ["performance"],
  },
  {
    id: "profile",
    ask: "How do I change my password?",
    title: "Profile",
    href: "/dashboard/profile",
    phrases: [
      "my profile",
      "edit profile",
      "edit my profile",
      "profile page",
      "change my name",
      "edit my name",
      "my institution",
      "change my password",
      "reset my password",
      "change password",
      "change my email",
      "change email",
      "user type",
    ],
    answer:
      "[Profile](/dashboard/profile) (sidebar → Account, or the avatar menu):\n- **Edit Profile** changes your name, institution and user type; **Save Changes** keeps them.\n- **Change Password:** **Send Password Reset Email** mails you a reset link.\n- Your email can't be changed on the site — use [Contact](/contact) if you need it changed.",
    related: ["settings", "sign-in"],
  },
  {
    id: "settings",
    ask: "How do I change the theme or text size?",
    title: "Settings",
    href: "/dashboard/settings",
    phrases: [
      "settings",
      "dark mode",
      "light mode",
      "theme",
      "text size",
      "font size",
      "bigger text",
      "notifications",
      "email notifications",
      "quiz reminders",
      "default quiz",
      "export my data",
      "data export",
    ],
    answer:
      "[Settings](/dashboard/settings) (sidebar → Account) saves changes as you make them:\n- **Appearance:** light or dark mode, text size and dashboard theme. The **T** and sun/moon icons at the top right do the same anywhere.\n- **Notifications:** email notifications, quiz reminders and progress updates.\n- **Quiz Settings:** your default questions, mode, timing, question type and categories for new quizzes.\n- **Privacy & Security:** **Request Data Export**.",
    related: ["profile", "delete-account"],
  },
  {
    id: "delete-account",
    ask: "How do I delete my account?",
    title: "Delete your account",
    href: "/dashboard/settings",
    phrases: [
      "delete my account",
      "delete account",
      "close my account",
      "remove my account",
      "deactivate",
    ],
    answer:
      "In [Settings](/dashboard/settings), scroll to **Danger Zone** → **Delete Account** and confirm with your password. This can't be undone, so consider **Request Data Export** first. If you can't confirm (for example, you sign in with Google), write to us through [Contact](/contact).",
    related: ["settings"],
  },
  {
    id: "contact",
    ask: "How do I report a bug or send feedback?",
    title: "Contact and feedback",
    href: "/contact",
    phrases: [
      "contact you",
      "contact the team",
      "contact page",
      "contact form",
      "contact pathology bites",
      "get in touch",
      "feedback",
      "suggestion",
      "make a suggestion",
      "feature request",
      "report a bug",
      "bug",
      "something is broken",
      "technical support",
      "help desk",
      "join as a creator",
      "contribute",
    ],
    answer:
      "Use the [Contact](/contact) page: choose **Technical Support** (bugs, site problems, suggestions) or **General Inquiry**, write at least 50 characters, and **Submit** — the team gets it by email. A problem with a specific question is quicker to report with its **flag icon**.",
    related: ["flag-question"],
  },
  {
    id: "albright",
    ask: "What can you do?",
    title: "Ask Dr. Albright",
    href: "/dashboard",
    phrases: [
      "what can you do",
      "what can you answer",
      "how do you work",
      "question limit",
      "daily limit",
      "how many questions can i ask",
      "recent questions",
      "clear history",
    ],
    answer:
      "I answer pathology questions — diagnoses, stains, findings, differentials, criteria — from WHO, PathologyOutlines, PubMed and the literature, with the sources linked under each answer.\n- **Recent questions** keeps your history; **Clear history** empties it.\n- Up to 50 questions a day (resets at midnight UTC).\n- I also know my way around the site — ask me how to use any part of it.",
    related: ["create-quiz", "tools"],
  },
  {
    id: "sign-in",
    ask: "How do I sign up or log in?",
    title: "Signing in",
    href: "/login",
    phrases: [
      "sign in",
      "log in",
      "login",
      "sign up",
      "signup",
      "create an account",
      "register",
      "forgot my password",
      "forgot password",
      "verify my email",
      "verification email",
      "log out",
      "sign out",
    ],
    answer:
      "- **Sign in** at [Login](/login) with Google or your email and password.\n- **New here?** [Sign up](/signup) with your name, email and a password (8+ characters, with upper- and lowercase letters and a number), then confirm the email we send.\n- **Forgot your password?** Use **Forgot?** on the login page, or [reset it here](/forgot-password).\n- **Log out** from the avatar menu at the top right.",
    related: ["profile"],
  },
];

/** Words that mark a question about using the site rather than about pathology. */
const SITE_CUE =
  /\b(?:how (?:do|can|to|does|would|should)|where (?:do|can|is|are|does)|can i|could i|is there (?:a|an|any)|are there|i (?:want|need|would like) to|i can'?t|i cannot|can'?t find|unable to|what is the|what are the|what does|help me|is it possible|on (?:this|the) (?:site|website|app)|pathology bites|my account|dashboard)\b/;

/** Whole-word phrase test; phrases are lowercase. */
function hasPhrase(q: string, phrase: string): boolean {
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${esc}(?:$|[^a-z0-9])`).test(q);
}

/**
 * The guide entry a question is about, or null. A match needs a site cue
 * ("how do I…", "where is…") or a multi-word phrase ("study plan", "cell
 * counter"); one bare word alone ("flag", "pan") never answers on its own,
 * so "Is CD30 positive in…" stays a pathology question. The entry with the
 * most matched words wins; ties go to the longest single phrase.
 */
export function matchGuide(question: string): GuideEntry | null {
  const q = normalizeQuestion(question).replace(/[’`]/g, "'");
  if (q.length > 160) return null;
  const cue = SITE_CUE.test(q);
  let best: { entry: GuideEntry; words: number; longest: number } | null = null;
  for (const entry of SITE_GUIDE) {
    let words = 0;
    let longest = 0;
    for (const p of entry.phrases) {
      if (!hasPhrase(q, p)) continue;
      const n = p.split(/\s+/).length;
      words += n;
      longest = Math.max(longest, n);
    }
    if (!words || (!cue && longest < 2)) continue;
    if (!best || words > best.words || (words === best.words && longest > best.longest)) {
      best = { entry, words, longest };
    }
  }
  return best?.entry ?? null;
}

/** Follow-up questions for an entry: its related entries, as questions. */
export function guideFollowUps(entry: GuideEntry): string[] {
  return (entry.related ?? [])
    .map((id) => SITE_GUIDE.find((e) => e.id === id))
    .filter((e): e is GuideEntry => !!e)
    .map((e) => e.ask);
}
