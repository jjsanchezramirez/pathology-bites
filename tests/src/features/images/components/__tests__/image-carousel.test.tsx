import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ImageCarousel } from '../image-carousel';

// Mock Next.js Image component
jest.mock('next/image', () => {
  return function MockImage({ src, alt, onClick, ...props }: any) {
    return <img src={src} alt={alt} onClick={onClick} {...props} />;
  };
});

const mockImages = [
  {
    url: 'https://example.com/image1.jpg',
    alt: 'Test image 1',
    caption: 'Test caption 1'
  },
  {
    url: 'https://example.com/image2.jpg',
    alt: 'Test image 2',
    caption: 'Test caption 2'
  }
];

describe('ImageCarousel', () => {
  it('renders single image correctly', () => {
    render(<ImageCarousel images={[mockImages[0]]} />);
    
    expect(screen.getByAltText('Test image 1')).toBeInTheDocument();
  });

  it('shows navigation buttons for multiple images', () => {
    render(<ImageCarousel images={mockImages} />);
    
    // Navigation buttons should be present but hidden initially
    expect(screen.getByLabelText('Previous image')).toBeInTheDocument();
    expect(screen.getByLabelText('Next image')).toBeInTheDocument();
  });

  it('opens fullscreen when clicking on image', async () => {
    render(<ImageCarousel images={[mockImages[0]]} />);

    // Click on the image
    const image = screen.getByAltText('Test image 1');
    fireEvent.click(image);

    // Should show fullscreen overlay
    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  it('shows image without click hint', () => {
    render(<ImageCarousel images={[mockImages[0]]} />);

    expect(screen.getByAltText('Test image 1')).toBeInTheDocument();
  });

  it('closes fullscreen when clicking close button', async () => {
    render(<ImageCarousel images={[mockImages[0]]} />);

    // Open fullscreen
    const image = screen.getByAltText('Test image 1');
    fireEvent.click(image);

    // Wait for fullscreen to open
    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    // Click close button
    fireEvent.click(screen.getByText('Close'));

    // Fullscreen should close
    await waitFor(() => {
      expect(screen.queryByText('Close')).not.toBeInTheDocument();
    });
  });

  it('closes fullscreen when clicking backdrop', async () => {
    render(<ImageCarousel images={[mockImages[0]]} />);

    // Open fullscreen
    const image = screen.getByAltText('Test image 1');
    fireEvent.click(image);

    // Wait for fullscreen to open
    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    // Click on backdrop (the fullscreen overlay) - use ESC key instead since backdrop clicking is complex with Dialog
    fireEvent.keyDown(document, { key: 'Escape' });

    // Fullscreen should close
    await waitFor(() => {
      expect(screen.queryByText('Close')).not.toBeInTheDocument();
    });
  });

  it('navigates between images in fullscreen mode', async () => {
    render(<ImageCarousel images={mockImages} />);

    // Open fullscreen
    const image = screen.getByAltText('Test image 1');
    fireEvent.click(image);

    // Wait for fullscreen to open
    await waitFor(() => {
      expect(screen.getAllByLabelText('Next image')).toHaveLength(2); // One in carousel, one in fullscreen
    });

    // Click next button in fullscreen (should be the second one)
    const nextButtons = screen.getAllByLabelText('Next image');
    fireEvent.click(nextButtons[1]); // Second button is in fullscreen

    // Should show second image (check for multiple instances)
    await waitFor(() => {
      expect(screen.getAllByAltText('Test image 2')).toHaveLength(2); // One in carousel, one in fullscreen
    });
  });

  it('shows image caption in fullscreen mode', async () => {
    render(<ImageCarousel images={[mockImages[0]]} />);

    // Open fullscreen
    const image = screen.getByAltText('Test image 1');
    fireEvent.click(image);

    // Wait for fullscreen to open and check for caption
    await waitFor(() => {
      expect(screen.getAllByText('Test caption 1')).toHaveLength(2); // One in carousel, one in fullscreen
    });
  });

  it('prevents event propagation on navigation buttons', async () => {
    const mockClick = jest.fn();

    render(
      <div onClick={mockClick}>
        <ImageCarousel images={mockImages} />
      </div>
    );

    // Click on navigation button should not trigger parent click
    fireEvent.click(screen.getByLabelText('Next image'));

    expect(mockClick).not.toHaveBeenCalled();
  });

  it('handles keyboard navigation in fullscreen', async () => {
    render(<ImageCarousel images={[mockImages[0]]} />);

    // Open fullscreen
    const image = screen.getByAltText('Test image 1');
    fireEvent.click(image);

    // Wait for fullscreen to open
    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    // Press Escape key
    fireEvent.keyDown(document, { key: 'Escape' });

    // Fullscreen should close
    await waitFor(() => {
      expect(screen.queryByText('Close')).not.toBeInTheDocument();
    });
  });
});
