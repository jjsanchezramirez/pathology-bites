import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UniversalTagSelector } from "@/features/questions/components/universal-tag-selector";
import { useUniversalTags } from "@/features/questions/hooks/use-universal-tags";

// Mock the hook
jest.mock("@/features/questions/hooks/use-universal-tags");
const mockUseUniversalTags = useUniversalTags as jest.MockedFunction<
  typeof useUniversalTags
>;

// Mock toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockTags = [
  { id: "1", name: "Pathology", created_at: "2024-01-03T00:00:00Z" },
  { id: "2", name: "Histology", created_at: "2024-01-02T00:00:00Z" },
  { id: "3", name: "Anatomy", created_at: "2024-01-01T00:00:00Z" },
];

const mockHookReturn = {
  recentTags: mockTags,
  searchTags: jest.fn(),
  createTag: jest.fn(),
  loading: false,
  error: null,
  refetch: jest.fn(),
};

describe("UniversalTagSelector", () => {
  const mockOnTagsChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUniversalTags.mockReturnValue(mockHookReturn);
  });

  describe("Basic Rendering", () => {
    it("renders with default props", () => {
      render(
        <UniversalTagSelector
          selectedTagIds={[]}
          onTagsChange={mockOnTagsChange}
        />,
      );

      expect(screen.getByLabelText("Tags")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search tags or type to create new..."),
      ).toBeInTheDocument();
    });

    it("renders with custom label and placeholder", () => {
      render(
        <UniversalTagSelector
          selectedTagIds={[]}
          onTagsChange={mockOnTagsChange}
          label="Custom Label"
          placeholder="Custom placeholder"
        />,
      );

      expect(screen.getByLabelText("Custom Label")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Custom placeholder"),
      ).toBeInTheDocument();
    });

    it("shows loading state", () => {
      mockUseUniversalTags.mockReturnValue({
        ...mockHookReturn,
        loading: true,
      });

      render(
        <UniversalTagSelector
          selectedTagIds={[]}
          onTagsChange={mockOnTagsChange}
        />,
      );

      expect(screen.getByText("Loading tags...")).toBeInTheDocument();
    });
  });

  describe("Tag Selection", () => {
    it("displays selected tags", () => {
      render(
        <UniversalTagSelector
          selectedTagIds={["1", "2"]}
          onTagsChange={mockOnTagsChange}
        />,
      );

      expect(screen.getByText("Pathology")).toBeInTheDocument();
      expect(screen.getByText("Histology")).toBeInTheDocument();
    });

    it("allows removing selected tags", async () => {
      const user = userEvent.setup();

      render(
        <UniversalTagSelector
          selectedTagIds={["1"]}
          onTagsChange={mockOnTagsChange}
        />,
      );

      const removeButton = screen.getByRole("button", {
        name: /Remove Pathology tag/i,
      });
      await user.click(removeButton);

      expect(mockOnTagsChange).toHaveBeenCalledWith([]);
    });

    it("shows dropdown when input is focused", async () => {
      const user = userEvent.setup();

      render(
        <UniversalTagSelector
          selectedTagIds={[]}
          onTagsChange={mockOnTagsChange}
        />,
      );

      const input = screen.getByPlaceholderText(
        "Search tags or type to create new...",
      );
      await user.click(input);

      // Should show recent tags
      expect(screen.getByText("Pathology")).toBeInTheDocument();
      expect(screen.getByText("Histology")).toBeInTheDocument();
      expect(screen.getByText("Anatomy")).toBeInTheDocument();
    });

    it("selects tag when clicked in dropdown", async () => {
      const user = userEvent.setup();

      render(
        <UniversalTagSelector
          selectedTagIds={[]}
          onTagsChange={mockOnTagsChange}
        />,
      );

      const input = screen.getByPlaceholderText(
        "Search tags or type to create new...",
      );
      await user.click(input);

      const tagButton = screen.getByRole("button", { name: "Pathology" });
      await user.click(tagButton);

      expect(mockOnTagsChange).toHaveBeenCalledWith(["1"]);
    });
  });

  describe("Search Functionality", () => {
    it("searches tags when typing", async () => {
      const user = userEvent.setup();
      const mockSearchResults = [mockTags[0]]; // Only Pathology
      mockHookReturn.searchTags.mockResolvedValue(mockSearchResults);

      render(
        <UniversalTagSelector
          selectedTagIds={[]}
          onTagsChange={mockOnTagsChange}
        />,
      );

      const input = screen.getByPlaceholderText(
        "Search tags or type to create new...",
      );
      await user.type(input, "path");

      await waitFor(() => {
        expect(mockHookReturn.searchTags).toHaveBeenCalledWith("path");
      });
    });

    it("shows search results", async () => {
      const user = userEvent.setup();
      const mockSearchResults = [mockTags[0]];
      mockHookReturn.searchTags.mockResolvedValue(mockSearchResults);

      render(
        <UniversalTagSelector
          selectedTagIds={[]}
          onTagsChange={mockOnTagsChange}
        />,
      );

      const input = screen.getByPlaceholderText(
        "Search tags or type to create new...",
      );
      await user.type(input, "path");

      await waitFor(() => {
        expect(screen.getByText("Pathology")).toBeInTheDocument();
        expect(screen.queryByText("Histology")).not.toBeInTheDocument();
      });
    });
  });

  describe("Tag Creation", () => {
    it("shows create option for new tag name", async () => {
      const user = userEvent.setup();
      mockHookReturn.searchTags.mockResolvedValue([]);

      render(
        <UniversalTagSelector
          selectedTagIds={[]}
          onTagsChange={mockOnTagsChange}
        />,
      );

      const input = screen.getByPlaceholderText(
        "Search tags or type to create new...",
      );
      await user.type(input, "NewTag");

      await waitFor(() => {
        expect(screen.getByText('Create "NewTag"')).toBeInTheDocument();
      });
    });

    it("creates new tag when clicking create option", async () => {
      const user = userEvent.setup();
      const newTag = {
        id: "4",
        name: "NewTag",
        created_at: "2024-01-04T00:00:00Z",
      };
      mockHookReturn.searchTags.mockResolvedValue([]);
      mockHookReturn.createTag.mockResolvedValue(newTag);

      render(
        <UniversalTagSelector
          selectedTagIds={[]}
          onTagsChange={mockOnTagsChange}
        />,
      );

      const input = screen.getByPlaceholderText(
        "Search tags or type to create new...",
      );
      await user.type(input, "NewTag");

      await waitFor(() => {
        expect(screen.getByText('Create "NewTag"')).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", {
        name: 'Create "NewTag"',
      });
      await user.click(createButton);

      expect(mockHookReturn.createTag).toHaveBeenCalledWith("NewTag");
      expect(mockOnTagsChange).toHaveBeenCalledWith(["4"]);
    });

    it("creates new tag when pressing Enter", async () => {
      const user = userEvent.setup();
      const newTag = {
        id: "4",
        name: "NewTag",
        created_at: "2024-01-04T00:00:00Z",
      };
      mockHookReturn.searchTags.mockResolvedValue([]);
      mockHookReturn.createTag.mockResolvedValue(newTag);

      render(
        <UniversalTagSelector
          selectedTagIds={[]}
          onTagsChange={mockOnTagsChange}
        />,
      );

      const input = screen.getByPlaceholderText(
        "Search tags or type to create new...",
      );
      await user.type(input, "NewTag");
      await user.keyboard("{Enter}");

      expect(mockHookReturn.createTag).toHaveBeenCalledWith("NewTag");
      expect(mockOnTagsChange).toHaveBeenCalledWith(["4"]);
    });
  });

  describe("Keyboard Navigation", () => {
    it("navigates with arrow keys", async () => {
      const user = userEvent.setup();

      render(
        <UniversalTagSelector
          selectedTagIds={[]}
          onTagsChange={mockOnTagsChange}
        />,
      );

      const input = screen.getByPlaceholderText(
        "Search tags or type to create new...",
      );
      await user.click(input);
      await user.keyboard("{ArrowDown}");

      // First item should be highlighted (visual feedback would be tested in e2e)
      await user.keyboard("{Enter}");

      expect(mockOnTagsChange).toHaveBeenCalledWith(["1"]);
    });

    it("closes dropdown with Escape key", async () => {
      const user = userEvent.setup();

      render(
        <UniversalTagSelector
          selectedTagIds={[]}
          onTagsChange={mockOnTagsChange}
        />,
      );

      const input = screen.getByPlaceholderText(
        "Search tags or type to create new...",
      );
      await user.click(input);

      // Dropdown should be open
      expect(screen.getByText("Pathology")).toBeInTheDocument();

      await user.keyboard("{Escape}");

      // Dropdown should be closed (tags no longer visible)
      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: "Pathology" }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Single Selection Mode", () => {
    it("replaces selection in single mode", async () => {
      const user = userEvent.setup();

      render(
        <UniversalTagSelector
          selectedTagIds={[]}
          onTagsChange={mockOnTagsChange}
          multiple={false}
        />,
      );

      const input = screen.getByPlaceholderText(
        "Search tags or type to create new...",
      );
      await user.click(input);

      const tagButton = screen.getByRole("button", { name: "Histology" });
      await user.click(tagButton);

      expect(mockOnTagsChange).toHaveBeenCalledWith(["2"]);
    });

    it("hides input when tag is selected in single mode", () => {
      render(
        <UniversalTagSelector
          selectedTagIds={["1"]}
          onTagsChange={mockOnTagsChange}
          multiple={false}
        />,
      );

      expect(
        screen.queryByPlaceholderText("Search tags or type to create new..."),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Pathology")).toBeInTheDocument();
    });
  });

  describe("Max Tags Limit", () => {
    it("respects maxTags limit", async () => {
      const user = userEvent.setup();

      render(
        <UniversalTagSelector
          selectedTagIds={["1"]}
          onTagsChange={mockOnTagsChange}
          maxTags={2}
        />,
      );

      const input = screen.getByPlaceholderText(
        "Search tags or type to create new...",
      );
      await user.click(input);

      const tagButton = screen.getByRole("button", { name: "Histology" });
      await user.click(tagButton);

      // Should add the second tag
      expect(mockOnTagsChange).toHaveBeenCalledWith(["1", "2"]);
    });

    it("hides input when max tags reached", () => {
      render(
        <UniversalTagSelector
          selectedTagIds={["1", "2"]}
          onTagsChange={mockOnTagsChange}
          maxTags={2}
        />,
      );

      expect(
        screen.queryByPlaceholderText("Search tags or type to create new..."),
      ).not.toBeInTheDocument();
    });
  });

  describe("Disabled State", () => {
    it("disables input when disabled prop is true", () => {
      render(
        <UniversalTagSelector
          selectedTagIds={[]}
          onTagsChange={mockOnTagsChange}
          disabled={true}
        />,
      );

      expect(
        screen.queryByPlaceholderText("Search tags or type to create new..."),
      ).not.toBeInTheDocument();
    });

    it("hides remove buttons when disabled", () => {
      render(
        <UniversalTagSelector
          selectedTagIds={["1"]}
          onTagsChange={mockOnTagsChange}
          disabled={true}
        />,
      );

      expect(screen.getByText("Pathology")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Remove.*tag/i }),
      ).not.toBeInTheDocument();
    });
  });
});
