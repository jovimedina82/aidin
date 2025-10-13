/**
 * Email message viewer component
 * Renders sanitized HTML email content with inline images and attachment gallery
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  htmlSanitized?: string;
  textPlain?: string;
  receivedAt: string;
}

interface MessageAsset {
  id: string;
  filename: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  kind: 'inline' | 'attachment' | 'derived';
  variant: 'original' | 'web' | 'thumb';
  url: string;
  createdAt: string;
}

interface EmailMessageViewerProps {
  message: EmailMessage;
  ticketId: string;
}

export function EmailMessageViewer({ message, ticketId }: EmailMessageViewerProps) {
  const [attachmentImages, setAttachmentImages] = useState<MessageAsset[]>([]);
  const [inlineImages, setInlineImages] = useState<string[]>([]);
  const [allImages, setAllImages] = useState<Array<{ url: string; filename: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(100);
  const contentRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Fetch attachment images (non-inline images)
    const fetchAttachments = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/tickets/${ticketId}/message-assets?kind=attachment&onlyImages=true&variant=web`
        );
        const data = await response.json();
        setAttachmentImages(data.assets || []);
      } catch (error) {
        // console.error('Failed to fetch attachment images:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttachments();
  }, [ticketId, message.id]);

  // Extract inline images from HTML content
  useEffect(() => {
    // Small delay to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      if (contentRef.current) {
        const imgElements = contentRef.current.querySelectorAll('img');
        const imageUrls: string[] = [];

        imgElements.forEach((img, index) => {
          const src = img.getAttribute('src');
          if (src) {
            imageUrls.push(src);

            // Make inline images clickable
            img.style.cursor = 'pointer';
            img.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Image clicked! Index:', index);
              setSelectedImageIndex(index);
            };
          }
        });

        setInlineImages(imageUrls);
        console.log('Found', imageUrls.length, 'inline images');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [message.htmlSanitized, message.id]);

  // Combine inline and attachment images
  useEffect(() => {
    const combined: Array<{ url: string; filename: string }> = [];

    // Add inline images first
    inlineImages.forEach((url, index) => {
      const filename = url.split('/').pop() || `inline-image-${index + 1}.png`;
      combined.push({ url, filename });
    });

    // Add attachment images
    attachmentImages.forEach((asset) => {
      combined.push({
        url: asset.url.replace('variant=web', 'variant=original'),
        filename: asset.filename
      });
    });

    setAllImages(combined);
  }, [inlineImages, attachmentImages]);

  const openGallery = (index: number) => {
    setSelectedImageIndex(index);
    setZoom(100);
  };

  const closeGallery = () => {
    setSelectedImageIndex(null);
    setZoom(100);
  };

  const goToNext = () => {
    if (selectedImageIndex !== null && selectedImageIndex < allImages.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
      setZoom(100);
    }
  };

  const goToPrevious = () => {
    if (selectedImageIndex !== null && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
      setZoom(100);
    }
  };

  const zoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 300));
  };

  const zoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 25));
  };

  const resetZoom = () => {
    setZoom(100);
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
    for (const image of allImages) {
      await downloadImage(image.url, image.filename);
      // Small delay to avoid overwhelming the browser
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
  }, [selectedImageIndex, allImages.length]);

  const selectedImage = selectedImageIndex !== null ? allImages[selectedImageIndex] : null;

  return (
    <div className="email-message-viewer">
      {/* Email metadata */}
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        <div><strong>From:</strong> {message.from}</div>
        <div><strong>Subject:</strong> {message.subject}</div>
        <div><strong>Received:</strong> {new Date(message.receivedAt).toLocaleString()}</div>
      </div>

      {/* Email body with inline images */}
      {/* @ts-ignore */}
      <CardContent>
        <div className="prose max-w-none email-content" ref={contentRef}>
          {message.htmlSanitized ? (
            <div
              className="email-html-body"
              dangerouslySetInnerHTML={{ __html: message.htmlSanitized }}
              style={{
                maxWidth: '100%',
                overflowWrap: 'break-word',
              }}
            />
          ) : (
            <p className="whitespace-pre-wrap">{message.textPlain}</p>
          )}
        </div>
      </CardContent>

      {/* Attachment images gallery */}
      {attachmentImages.length > 0 && (
        // @ts-ignore
        <CardContent className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Attachments ({attachmentImages.length})</h3>
            <button
              onClick={downloadAllImages}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Download All
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {attachmentImages.map((asset, index) => (
              <div
                key={asset.id}
                className="relative cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => openGallery(inlineImages.length + index)}
              >
                <img
                  src={asset.url}
                  alt={asset.filename}
                  loading="lazy"
                  className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                />
                <div className="text-xs text-gray-500 mt-1 truncate">
                  {asset.filename}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}

      {/* Image Gallery Modal */}
      {selectedImage && selectedImageIndex !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
          onClick={closeGallery}
        >
          {/* Top toolbar */}
          <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-50 p-4 flex items-center justify-between">
            <div className="text-white text-sm">
              {selectedImageIndex + 1} / {allImages.length}
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
              {allImages.length > 1 && (
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
          {allImages.length > 1 && (
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
              {selectedImageIndex < allImages.length - 1 && (
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

      {/* CSS for email content */}
      <style jsx global>{`
        .email-html-body img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 1rem 0;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          border-radius: 4px;
        }

        .email-html-body img:hover {
          transform: scale(1.02);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .email-html-body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }

        .dark .email-html-body {
          color: #e5e7eb;
        }

        .email-html-body a {
          color: #3b82f6;
          text-decoration: underline;
        }

        .email-html-body a:hover {
          color: #2563eb;
        }

        .email-html-body table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
        }

        .email-html-body th,
        .email-html-body td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }

        .email-html-body th {
          background-color: #f3f4f6;
          font-weight: bold;
        }

        .dark .email-html-body th {
          background-color: #374151;
        }

        .dark .email-html-body th,
        .dark .email-html-body td {
          border-color: #4b5563;
        }
      `}</style>
    </div>
  );
}
