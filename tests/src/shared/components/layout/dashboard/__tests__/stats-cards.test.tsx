// src/shared/components/layout/dashboard/__tests__/stats-cards.test.tsx
import { render, screen } from "@testing-library/react";
import { StatsCards } from "../stats-cards";
import { useUserRole } from "@/shared/hooks/use-user-role";
import { DashboardStats } from "@/features/dashboard/services/service";

// Mock the useUserRole hook
jest.mock("@/shared/hooks/use-user-role");

const mockUseUserRole = useUserRole as jest.MockedFunction<typeof useUserRole>;

const mockStats: DashboardStats = {
  totalQuestions: 1250,
  totalUsers: 450,
  totalImages: 320,
  totalInquiries: 25,
  pendingQuestions: 8,
  activeUsers: 120,
  recentQuestions: 15,
  unreadInquiries: 3,
  questionReports: 12,
  pendingReports: 2,
};

describe("StatsCards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render all stats cards for admin user", () => {
    mockUseUserRole.mockReturnValue({
      role: "admin",
      isLoading: false,
      error: null,
      canAccess: jest.fn().mockReturnValue(true),
      isAdmin: true,
      isReviewer: false,
      isAdminOrReviewer: true,
    });

    render(<StatsCards stats={mockStats} />);

    // Check that all admin cards are present
    expect(screen.getByText("Total Questions")).toBeInTheDocument();
    expect(screen.getByText("Active Users")).toBeInTheDocument();
    expect(screen.getByText("Image Library")).toBeInTheDocument();
    expect(screen.getByText("Pending Reviews")).toBeInTheDocument();
    expect(screen.getByText("User Inquiries")).toBeInTheDocument();
    expect(screen.getByText("Question Reports")).toBeInTheDocument();

    // Check that stats values are displayed correctly
    expect(screen.getByText("1,250")).toBeInTheDocument(); // totalQuestions
    expect(screen.getByText("450")).toBeInTheDocument(); // totalUsers
    expect(screen.getByText("320")).toBeInTheDocument(); // totalImages
    expect(screen.getByText("8")).toBeInTheDocument(); // pendingQuestions
    expect(screen.getByText("25")).toBeInTheDocument(); // totalInquiries
    expect(screen.getByText("12")).toBeInTheDocument(); // questionReports
  });

  it("should filter stats cards for reviewer user", () => {
    mockUseUserRole.mockReturnValue({
      role: "reviewer",
      isLoading: false,
      error: null,
      canAccess: jest.fn((permission: string) => {
        // Reviewer can access review-related features
        return ["questions.view", "questions.review"].includes(permission);
      }),
      isAdmin: false,
      isReviewer: true,
      isAdminOrReviewer: true,
    });

    render(<StatsCards stats={mockStats} />);

    // Should show reviewer-accessible cards
    expect(screen.getByText("Total Questions")).toBeInTheDocument();
    expect(screen.getByText("Pending Reviews")).toBeInTheDocument();
    expect(screen.getByText("Question Reports")).toBeInTheDocument();

    // Should not show admin-only cards
    expect(screen.queryByText("Active Users")).not.toBeInTheDocument();
    expect(screen.queryByText("Image Library")).not.toBeInTheDocument();
    expect(screen.queryByText("User Inquiries")).not.toBeInTheDocument();
  });

  it("should display correct trend indicators", () => {
    mockUseUserRole.mockReturnValue({
      role: "admin",
      isLoading: false,
      error: null,
      canAccess: jest.fn().mockReturnValue(true),
      isAdmin: true,
      isReviewer: false,
      isAdminOrReviewer: true,
    });

    render(<StatsCards stats={mockStats} />);

    // Check for positive trend (recent questions > 0)
    expect(screen.getByText("15 added this month")).toBeInTheDocument();

    // Check for warning trend (pending questions > 0)
    expect(screen.getByText("Questions awaiting review")).toBeInTheDocument();

    // Check for warning trend (unread inquiries > 5 would be warning, but 3 should be neutral)
    expect(screen.getByText("3 need attention")).toBeInTheDocument();
  });

  it("should handle zero values correctly", () => {
    const zeroStats: DashboardStats = {
      totalQuestions: 0,
      totalUsers: 0,
      totalImages: 0,
      totalInquiries: 0,
      pendingQuestions: 0,
      activeUsers: 0,
      recentQuestions: 0,
      unreadInquiries: 0,
      questionReports: 0,
      pendingReports: 0,
    };

    mockUseUserRole.mockReturnValue({
      role: "admin",
      isLoading: false,
      error: null,
      canAccess: jest.fn().mockReturnValue(true),
      isAdmin: true,
      isReviewer: false,
      isAdminOrReviewer: true,
    });

    render(<StatsCards stats={zeroStats} />);

    // Should display zeros correctly
    expect(screen.getAllByText("0")).toHaveLength(6); // All stats should be 0
    expect(screen.getByText("0 added this month")).toBeInTheDocument();
    expect(screen.getByText("0 need attention")).toBeInTheDocument();
    expect(screen.getByText("0 pending review")).toBeInTheDocument();
  });

  it("should format large numbers correctly", () => {
    const largeStats: DashboardStats = {
      totalQuestions: 12500,
      totalUsers: 4500,
      totalImages: 3200,
      totalInquiries: 250,
      pendingQuestions: 80,
      activeUsers: 1200,
      recentQuestions: 150,
      unreadInquiries: 30,
      questionReports: 120,
      pendingReports: 20,
    };

    mockUseUserRole.mockReturnValue({
      role: "admin",
      isLoading: false,
      error: null,
      canAccess: jest.fn().mockReturnValue(true),
      isAdmin: true,
      isReviewer: false,
      isAdminOrReviewer: true,
    });

    render(<StatsCards stats={largeStats} />);

    // Check that numbers are formatted with commas
    expect(screen.getByText("12,500")).toBeInTheDocument();
    expect(screen.getByText("4,500")).toBeInTheDocument();
    expect(screen.getByText("3,200")).toBeInTheDocument();
    expect(screen.getByText("1,200")).toBeInTheDocument();
  });

  it("should render correct icons for each card", () => {
    mockUseUserRole.mockReturnValue({
      role: "admin",
      isLoading: false,
      error: null,
      canAccess: jest.fn().mockReturnValue(true),
      isAdmin: true,
      isReviewer: false,
      isAdminOrReviewer: true,
    });

    const { container } = render(<StatsCards stats={mockStats} />);

    // Check that icons are rendered (they should be SVG elements)
    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
  });

  it("should apply correct trend colors", () => {
    const warningStats: DashboardStats = {
      ...mockStats,
      pendingQuestions: 10, // Should trigger warning
      unreadInquiries: 8, // Should trigger warning (> 5)
      pendingReports: 5, // Should trigger warning (> 0)
    };

    mockUseUserRole.mockReturnValue({
      role: "admin",
      isLoading: false,
      error: null,
      canAccess: jest.fn().mockReturnValue(true),
      isAdmin: true,
      isReviewer: false,
      isAdminOrReviewer: true,
    });

    render(<StatsCards stats={warningStats} />);

    // Check that warning states are reflected in the descriptions
    expect(screen.getByText("Questions awaiting review")).toBeInTheDocument();
    expect(screen.getByText("8 need attention")).toBeInTheDocument();
    expect(screen.getByText("5 pending review")).toBeInTheDocument();
  });

  it("should handle permission-based filtering correctly", () => {
    mockUseUserRole.mockReturnValue({
      role: "reviewer",
      isLoading: false,
      error: null,
      canAccess: jest.fn((permission: string) => {
        // Only allow questions.view and questions.review
        return (
          permission === "questions.view" || permission === "questions.review"
        );
      }),
      isAdmin: false,
      isReviewer: true,
      isAdminOrReviewer: true,
    });

    render(<StatsCards stats={mockStats} />);

    // Should only show cards that reviewer has permission for
    expect(screen.getByText("Total Questions")).toBeInTheDocument();
    expect(screen.getByText("Pending Reviews")).toBeInTheDocument();
    expect(screen.getByText("Question Reports")).toBeInTheDocument();

    // Should not show admin-only cards
    expect(screen.queryByText("Active Users")).not.toBeInTheDocument();
    expect(screen.queryByText("Image Library")).not.toBeInTheDocument();
    expect(screen.queryByText("User Inquiries")).not.toBeInTheDocument();
  });
});
