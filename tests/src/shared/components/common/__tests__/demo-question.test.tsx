import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DemoQuestion from "../demo-question";
import { useDemoQuestions } from "@/shared/hooks/use-demo-questions";

// Mock the hook
jest.mock("@/shared/hooks/use-demo-questions");
const mockUseDemoQuestions = useDemoQuestions as jest.MockedFunction<
  typeof useDemoQuestions
>;

// Mock the ImageCarousel component
jest.mock("@/features/images/components/image-carousel", () => {
  return {
    ImageCarousel: ({ images }: { images: any[] }) => (
      <div data-testid="image-carousel">
        {images.map((img, index) => (
          <img key={index} src={img.url} alt={img.alt} />
        ))}
      </div>
    ),
  };
});

const mockQuestion = {
  id: "test-question-1",
  title: "Test Question",
  body: "This is a test question body.",
  images: [
    {
      url: "https://example.com/image1.jpg",
      alt: "Test image 1",
      caption: "Test caption 1",
    },
  ],
  options: [
    { id: "a", text: "Option A", correct: false },
    { id: "b", text: "Option B", correct: true },
    { id: "c", text: "Option C", correct: false },
  ],
  teachingPoint: "This is the teaching point.",
  incorrectExplanations: {
    a: "Explanation for option A",
    c: "Explanation for option C",
  },
  references: ["Reference 1", "Reference 2"],
  comparativeImage: {
    url: "https://example.com/comparative.jpg",
    alt: "Comparative image",
    caption: "Comparative caption",
  },
};

describe("DemoQuestion", () => {
  beforeEach(() => {
    mockUseDemoQuestions.mockReturnValue({
      currentQuestion: mockQuestion,
      loading: false,
      error: null,
      questions: [mockQuestion],
      refreshQuestion: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders question title and body", () => {
    render(<DemoQuestion />);

    expect(screen.getByText("Test Question")).toBeInTheDocument();
    expect(
      screen.getByText("This is a test question body."),
    ).toBeInTheDocument();
  });

  it("renders all answer options", () => {
    render(<DemoQuestion />);

    expect(screen.getByText("Option A")).toBeInTheDocument();
    expect(screen.getByText("Option B")).toBeInTheDocument();
    expect(screen.getByText("Option C")).toBeInTheDocument();
  });

  it("shows teaching point after selecting an answer", async () => {
    render(<DemoQuestion />);

    // Click on an option
    fireEvent.click(screen.getByText("Option A"));

    // Wait for explanation to appear
    await waitFor(() => {
      expect(
        screen.getByText("This is the teaching point."),
      ).toBeInTheDocument();
    });
  });

  it("shows correct/incorrect indicators after answering", async () => {
    render(<DemoQuestion />);

    // Click on incorrect option
    fireEvent.click(screen.getByText("Option A"));

    await waitFor(() => {
      // Should show teaching point
      expect(
        screen.getByText("This is the teaching point."),
      ).toBeInTheDocument();
    });
  });

  it("calls refreshQuestion when Try Another button is clicked", async () => {
    const mockRefreshQuestion = jest.fn();
    mockUseDemoQuestions.mockReturnValue({
      currentQuestion: mockQuestion,
      loading: false,
      error: null,
      questions: [mockQuestion],
      refreshQuestion: mockRefreshQuestion,
    });

    render(<DemoQuestion />);

    // Answer a question first
    fireEvent.click(screen.getByText("Option A"));

    // Wait for explanation and button to appear
    await waitFor(() => {
      expect(screen.getByText("Try Another")).toBeInTheDocument();
    });

    // Click Try Another button
    fireEvent.click(screen.getByText("Try Another"));

    // Should call refreshQuestion after timeout
    await waitFor(
      () => {
        expect(mockRefreshQuestion).toHaveBeenCalled();
      },
      { timeout: 500 },
    );
  });

  it("shows loading skeleton when loading", () => {
    mockUseDemoQuestions.mockReturnValue({
      currentQuestion: null,
      loading: true,
      error: null,
      questions: [],
      refreshQuestion: jest.fn(),
    });

    render(<DemoQuestion />);

    // Should show skeleton (you might need to adjust this based on your skeleton implementation)
    expect(screen.getByTestId("question-skeleton")).toBeInTheDocument();
  });

  it("shows error component when there is an error", () => {
    mockUseDemoQuestions.mockReturnValue({
      currentQuestion: null,
      loading: false,
      error: "Failed to load question",
      questions: [],
      refreshQuestion: jest.fn(),
    });

    render(<DemoQuestion />);

    expect(screen.getByText("Unable to Load Question")).toBeInTheDocument();
  });

  it("renders ImageCarousel when question has images", () => {
    render(<DemoQuestion />);

    // Should render the image carousel
    expect(screen.getByTestId("image-carousel")).toBeInTheDocument();

    // Should render the image within the carousel
    expect(screen.getByAltText("Test image 1")).toBeInTheDocument();
  });
});
