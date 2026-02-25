import { NextRequest, NextResponse } from "next/server";
import { PATHOLOGY_JOURNALS } from "@/shared/utils/domain/pathology-journals";

/**
 * Semantic Scholar API route for fetching academic references
 * Optimized for pathology research with advanced filtering options
 */

/**
 * @swagger
 * /api/admin/questions/fetch-references:
 *   post:
 *     summary: Fetch academic references from Semantic Scholar
 *     description: Search for academic papers using Semantic Scholar API (simplified version for question creation). Returns up to 5 references formatted as citation strings. Requires admin, creator, or reviewer role.
 *     tags:
 *       - Admin - Questions
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - searchTerms
 *             properties:
 *               searchTerms:
 *                 type: string
 *                 description: Search query for academic papers
 *     responses:
 *       200:
 *         description: Successfully retrieved references
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 references:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Array of formatted citation strings
 *                 cached:
 *                   type: boolean
 *       400:
 *         description: Bad request - missing searchTerms
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - requires admin, creator, or reviewer role
 *       429:
 *         description: Rate limited by Semantic Scholar
 *       500:
 *         description: Internal server error
 *   get:
 *     summary: Advanced search for academic references
 *     description: Search Semantic Scholar with advanced filtering options (citations, open access, publication type, etc.). Returns detailed paper information. Requires admin, creator, or reviewer role.
 *     tags:
 *       - Admin - Questions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: limit
 *         schema:
 *           type: string
 *           default: "20"
 *         description: Maximum number of results
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [citations, year-desc, year-asc, relevance]
 *           default: citations
 *         description: Sort order for results
 *       - in: query
 *         name: minCitations
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Minimum citation count filter
 *       - in: query
 *         name: onlyOpenAccess
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Filter to only open access papers
 *       - in: query
 *         name: onlyReviews
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Filter to only review articles
 *       - in: query
 *         name: yearRange
 *         schema:
 *           type: string
 *           enum: [all, last5, last10]
 *           default: all
 *         description: Year range filter
 *       - in: query
 *         name: venue
 *         schema:
 *           type: string
 *         description: Filter by venue/journal (use "pathology-journals" for curated list)
 *       - in: query
 *         name: publicationType
 *         schema:
 *           type: string
 *         description: Filter by publication type
 *     responses:
 *       200:
 *         description: Successfully retrieved papers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 papers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       paperId:
 *                         type: string
 *                       title:
 *                         type: string
 *                       authors:
 *                         type: array
 *                         items:
 *                           type: string
 *                       year:
 *                         type: integer
 *                       venue:
 *                         type: string
 *                       journal:
 *                         type: string
 *                       citationCount:
 *                         type: integer
 *                       isOpenAccess:
 *                         type: boolean
 *                       url:
 *                         type: string
 *       400:
 *         description: Bad request - missing query parameter
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - requires admin, creator, or reviewer role
 *       500:
 *         description: Internal server error
 */

// Type definitions for Semantic Scholar API responses
interface SemanticScholarAuthor {
  authorId: string;
  name: string;
  paperCount?: number;
  citationCount?: number;
}

interface SemanticScholarPaper {
  paperId: string;
  title: string;
  authors: SemanticScholarAuthor[];
  year: number | null;
  venue: string;
  journal?: {
    name: string;
  };
  publicationDate: string | null;
  citationCount: number;
  influentialCitationCount?: number;
  isOpenAccess: boolean;
  openAccessPdf?: {
    url: string;
  } | null;
  abstract: string | null;
  publicationTypes?: string[];
}

export async function POST(request: NextRequest) {
  try {
    // Auth check - require admin, creator, or reviewer role
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !["admin", "creator", "reviewer"].includes(userRole || "")) {
      return NextResponse.json(
        { error: userRole ? "Forbidden - Admin access required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    const body = await request.json();
    const searchTerms = body.searchTerms;

    if (!searchTerms || typeof searchTerms !== "string") {
      return NextResponse.json(
        { error: "searchTerms is required in request body" },
        { status: 400 }
      );
    }

    // Build Semantic Scholar API URL
    const semanticScholarUrl = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
    semanticScholarUrl.searchParams.append("query", searchTerms);
    semanticScholarUrl.searchParams.append("limit", "5"); // Limit to 5 references for question creation
    semanticScholarUrl.searchParams.append(
      "fields",
      "paperId,title,authors,year,venue,journal,publicationDate,citationCount,isOpenAccess,openAccessPdf"
    );

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
      headers["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;
    }

    const response = await fetch(semanticScholarUrl.toString(), {
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json(
          { error: "Rate limited by Semantic Scholar. Please try again later." },
          { status: 429 }
        );
      }
      throw new Error(`Semantic Scholar API error: ${response.status}`);
    }

    const data = await response.json();
    const papers = data.data || [];

    // Format references as strings
    const references = papers.map((paper: SemanticScholarPaper) => {
      const authors =
        paper.authors
          ?.map((a) => a.name)
          .slice(0, 3)
          .join(", ") || "Unknown";
      const moreAuthors = paper.authors?.length > 3 ? " et al." : "";
      const year = paper.year || "n.d.";
      const title = paper.title || "Untitled";
      const venue = paper.venue || paper.journal?.name || "";
      const venueText = venue ? ` ${venue}.` : "";
      const url = `https://www.semanticscholar.org/paper/${paper.paperId}`;

      return `${authors}${moreAuthors}. (${year}). ${title}.${venueText} ${url}`;
    });

    return NextResponse.json({
      success: true,
      references,
      cached: false,
    });
  } catch (error) {
    console.error("Semantic Scholar API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch references from Semantic Scholar",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Auth check - require admin, creator, or reviewer role
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !["admin", "creator", "reviewer"].includes(userRole || "")) {
      return NextResponse.json(
        { error: userRole ? "Forbidden - Admin access required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const limit = searchParams.get("limit") || "20";
    const sortBy = searchParams.get("sortBy") || "citations";
    const minCitations = parseInt(searchParams.get("minCitations") || "0");
    const onlyOpenAccess = searchParams.get("onlyOpenAccess") === "true";
    const onlyReviews = searchParams.get("onlyReviews") === "true";
    const yearRange = searchParams.get("yearRange") || "all";
    const venue = searchParams.get("venue") || "";
    const publicationType = searchParams.get("publicationType") || "";

    if (!query) {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
    }

    // Build Semantic Scholar API URL
    const semanticScholarUrl = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
    semanticScholarUrl.searchParams.append("query", query);
    semanticScholarUrl.searchParams.append("limit", limit);
    semanticScholarUrl.searchParams.append(
      "fields",
      "paperId,title,authors,year,venue,journal,publicationDate,citationCount,influentialCitationCount,abstract,isOpenAccess,openAccessPdf,publicationTypes"
    );

    // Add year range filter if specified
    const currentYear = new Date().getFullYear();
    if (yearRange === "last5") {
      const startYear = currentYear - 5;
      semanticScholarUrl.searchParams.append("year", `${startYear}-`);
    } else if (yearRange === "last10") {
      const startYear = currentYear - 10;
      semanticScholarUrl.searchParams.append("year", `${startYear}-`);
    }

    // Add venue filter if specified (but not for 'pathology-journals' - we'll filter that client-side)
    if (venue && venue !== "pathology-journals") {
      semanticScholarUrl.searchParams.append("venue", venue);
    }

    // Add publication type filter if specified
    if (publicationType) {
      semanticScholarUrl.searchParams.append("publicationTypes", publicationType);
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
      headers["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;
    }

    const response = await fetch(semanticScholarUrl.toString(), {
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json(
          { error: "Rate limited by Semantic Scholar. Please try again later." },
          { status: 429 }
        );
      }
      console.error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
      throw new Error(`Semantic Scholar API error: ${response.status}`);
    }

    const data = await response.json();
    let papers = data.data || [];

    // Apply filters
    if (onlyReviews) {
      papers = papers.filter((paper: SemanticScholarPaper) => {
        const title = paper.title?.toLowerCase() || "";
        const abstract = paper.abstract?.toLowerCase() || "";
        const publicationTypes = paper.publicationTypes || [];
        return (
          publicationTypes.includes("Review") ||
          title.includes("review") ||
          abstract.includes("systematic review") ||
          abstract.includes("meta-analysis")
        );
      });
    }

    if (onlyOpenAccess) {
      papers = papers.filter((paper: SemanticScholarPaper) => paper.isOpenAccess === true);
    }

    if (minCitations > 0) {
      papers = papers.filter(
        (paper: SemanticScholarPaper) => (paper.citationCount || 0) >= minCitations
      );
    }

    // Filter by pathology journals if specified
    if (venue === "pathology-journals") {
      papers = papers.filter((paper: SemanticScholarPaper) => {
        const paperVenue = paper.venue || paper.journal?.name || "";
        return PATHOLOGY_JOURNALS.some(
          (journal) =>
            paperVenue.toLowerCase().includes(journal.toLowerCase()) ||
            journal.toLowerCase().includes(paperVenue.toLowerCase())
        );
      });
    }

    // Sort results based on sortBy parameter
    switch (sortBy) {
      case "citations":
        papers.sort(
          (a: SemanticScholarPaper, b: SemanticScholarPaper) =>
            (b.citationCount || 0) - (a.citationCount || 0)
        );
        break;
      case "year-desc":
        papers.sort(
          (a: SemanticScholarPaper, b: SemanticScholarPaper) => (b.year || 0) - (a.year || 0)
        );
        break;
      case "year-asc":
        papers.sort(
          (a: SemanticScholarPaper, b: SemanticScholarPaper) => (a.year || 0) - (b.year || 0)
        );
        break;
      case "relevance":
        // Keep original order from Semantic Scholar (already sorted by relevance)
        break;
      default:
        papers.sort(
          (a: SemanticScholarPaper, b: SemanticScholarPaper) =>
            (b.citationCount || 0) - (a.citationCount || 0)
        );
    }

    const results = papers;

    return NextResponse.json({
      total: results.length,
      papers: results.map((paper: SemanticScholarPaper) => ({
        paperId: paper.paperId,
        title: paper.title,
        authors: paper.authors?.map((a) => a.name) || [],
        year: paper.year,
        venue: paper.venue,
        journal: paper.journal?.name || paper.venue,
        publicationDate: paper.publicationDate,
        citationCount: paper.citationCount,
        influentialCitationCount: paper.influentialCitationCount,
        abstract: paper.abstract,
        isOpenAccess: paper.isOpenAccess,
        openAccessPdf: paper.openAccessPdf?.url,
        publicationTypes: paper.publicationTypes || [],
        url: `https://www.semanticscholar.org/paper/${paper.paperId}`,
      })),
    });
  } catch (error) {
    console.error("Semantic Scholar API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch papers from Semantic Scholar",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
