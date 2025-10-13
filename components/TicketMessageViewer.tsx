/**
 * Ticket message viewer with clickable inline images
 * Wraps HTML content and makes images clickable for gallery view
 */

'use client';

import { useRef, useEffect, useState } from 'react';
import { Download, ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface TicketMessageViewerProps {
  html: string;
  className?: string;
}

export function TicketMessageViewer({ html, className = '' }: TicketMessageViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<Array<{ url: string; filename: string }>>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(100); // Zoom percentage
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });

  // Extract images from HTML and make them clickable
  useEffect(() => {
    const timer = setTimeout(() => {
      if (contentRef.current) {
        const imgElements = contentRef.current.querySelectorAll('img');
        const imageList: Array<{ url: string; filename: string }> = [];

        imgElements.forEach((img, index) => {
          const src = img.getAttribute('src');
          if (src) {
            const filename = src.split('/').pop() || `image-${index + 1}.png`;
            imageList.push({ url: src, filename });

            // Style images
            img.style.cursor = 'pointer';
            img.style.position = 'relative';
          }
        });

        setImages(imageList);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [html]);

  // Add click handler using event delegation (survives re-renders)
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Check if clicked element is an image
    if (target.tagName === 'IMG') {
      e.preventDefault();
      e.stopPropagation();

      // Find the index of this image
      if (contentRef.current) {
        const imgElements = Array.from(contentRef.current.querySelectorAll('img'));
        const index = imgElements.indexOf(target as HTMLImageElement);

        if (index !== -1) {
          setSelectedImageIndex(index);
        }
      }
    }
  };

  const closeGallery = () => {
    setSelectedImageIndex(null);
    setZoom(100);
  };

  const goToNext = () => {
    if (selectedImageIndex !== null && selectedImageIndex < images.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
      setZoom(100); // Reset zoom when changing images
    }
  };

  const goToPrevious = () => {
    if (selectedImageIndex !== null && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
      setZoom(100); // Reset zoom when changing images
    }
  };

  // Drag-to-pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 100 && imageContainerRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setScrollStart({
        x: imageContainerRef.current.scrollLeft,
        y: imageContainerRef.current.scrollTop
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && imageContainerRef.current) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      imageContainerRef.current.scrollLeft = scrollStart.x - dx;
      imageContainerRef.current.scrollTop = scrollStart.y - dy;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const zoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 300)); // Max 300%
  };

  const zoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 25)); // Min 25%
  };

  const resetZoom = () => {
    setZoom(100);
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  const downloadAllImages = async () => {
    for (const image of images) {
      await downloadImage(image.url, image.filename);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImageIndex === null) return;

      if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'Escape') {
        closeGallery();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageIndex, images.length]);

  const selectedImage = selectedImageIndex !== null ? images[selectedImageIndex] : null;

  return (
    <>
      <div
        ref={contentRef}
        className={className}
        onClick={handleContainerClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Image Gallery Modal */}
      {selectedImage && selectedImageIndex !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
          onClick={closeGallery}
        >
          {/* Top toolbar */}
          <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-50 p-4 flex items-center justify-between">
            <div className="text-white text-sm">
              {selectedImageIndex + 1} / {images.length}
            </div>
            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  zoomOut();
                }}
                className="text-white hover:text-gray-300 p-2 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors"
                title="Zoom out"
                disabled={zoom <= 25}
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-white text-sm min-w-[4rem] text-center">
                {zoom}%
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  zoomIn();
                }}
                className="text-white hover:text-gray-300 p-2 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors"
                title="Zoom in"
                disabled={zoom >= 300}
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetZoom();
                }}
                className="text-white hover:text-gray-300 p-2 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors"
                title="Reset zoom (100%)"
              >
                <Maximize2 className="w-5 h-5" />
              </button>

              {/* Divider */}
              <div className="w-px h-6 bg-white bg-opacity-30 mx-1"></div>

              {/* Download buttons */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadImage(selectedImage.url, selectedImage.filename);
                }}
                className="text-white hover:text-gray-300 p-2 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors"
                title="Download this image"
              >
                <Download className="w-5 h-5" />
              </button>
              {images.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadAllImages();
                  }}
                  className="text-white hover:text-gray-300 px-3 py-2 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors text-sm flex items-center gap-1"
                  title="Download all images"
                >
                  <Download className="w-4 h-4" />
                  All
                </button>
              )}

              {/* Close button */}
              <button
                onClick={closeGallery}
                className="text-white hover:text-gray-300 p-2 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Image container */}
          <div
            ref={imageContainerRef}
            className="relative max-w-7xl max-h-[80vh] mx-4 overflow-auto"
            style={{
              cursor: zoom > 100 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              scrollbarWidth: 'none', // Firefox
              msOverflowStyle: 'none', // IE/Edge
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage.url}
              alt={selectedImage.filename}
              style={{
                width: zoom === 100 ? 'auto' : `${zoom}%`,
                maxWidth: zoom === 100 ? '100%' : 'none',
                maxHeight: zoom === 100 ? '80vh' : 'none',
                transform: zoom === 100 ? 'none' : 'scale(1)',
                transition: 'all 0.2s ease-in-out',
                pointerEvents: isDragging ? 'none' : 'auto',
              }}
              className="object-contain mx-auto"
            />
          </div>

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              {selectedImageIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrevious();
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-3 hover:bg-opacity-75 transition-all"
                  title="Previous (←)"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
              )}
              {selectedImageIndex < images.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-3 hover:bg-opacity-75 transition-all"
                  title="Next (→)"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              )}
            </>
          )}

          {/* Bottom filename */}
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4 text-center">
            <div className="text-white text-sm truncate">
              {selectedImage.filename}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
