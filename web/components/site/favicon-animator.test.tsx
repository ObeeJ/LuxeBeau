import { render } from "@testing-library/react";
import { FaviconAnimator } from "./favicon-animator";

describe("FaviconAnimator Component", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      quadraticCurveTo: jest.fn(),
      closePath: jest.fn(),
      fill: jest.fn(),
      arc: jest.fn(),
      stroke: jest.fn(),
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = jest.fn().mockReturnValue("data:image/png;base64,mock");

    // Mock matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("mounts and sets up 10-second favicon animation interval without crashing", () => {
    const { unmount } = render(<FaviconAnimator />);
    
    // Fast-forward timers
    jest.advanceTimersByTime(10000);
    
    unmount();
  });
});
