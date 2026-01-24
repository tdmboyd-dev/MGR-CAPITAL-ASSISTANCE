"use client";

/**
 * FeedbackButton.tsx — MGR CAPITAL ASSISTANCE
 * Phase 18: User Feedback Loop
 *
 * Floating feedback button with modal form.
 * Allows users to rate features and provide comments.
 */

import { useState, useEffect } from "react";
import { MessageSquarePlus, Star, X, Send, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { usePathname } from "next/navigation";

const FEEDBACK_CATEGORIES = [
  { value: "GENERAL", label: "General Feedback" },
  { value: "AI_RESPONSE", label: "AI Response" },
  { value: "FEATURE", label: "Feature Request" },
  { value: "UI_UX", label: "UI/UX" },
  { value: "BUG", label: "Bug Report" },
  { value: "PERFORMANCE", label: "Performance" },
  { value: "TRAINING", label: "Training" },
  { value: "DOCUMENT", label: "Documents" },
];

interface FeedbackButtonProps {
  feature?: string; // Pre-selected feature context
  aiResponseId?: string; // Link to AI response if rating AI
  sessionContext?: Record<string, unknown>;
}

export function FeedbackButton({
  feature,
  aiResponseId,
  sessionContext,
}: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState(feature ? "FEATURE" : "GENERAL");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const pathname = usePathname();

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      // Delay reset to allow close animation
      const timeout = setTimeout(() => {
        if (!isOpen) {
          setRating(0);
          setHoverRating(0);
          setCategory(feature ? "FEATURE" : "GENERAL");
          setComment("");
          setIsSubmitted(false);
        }
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, feature]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category,
          feature,
          rating,
          comment: comment.trim() || null,
          pageUrl: pathname,
          sessionContext,
          aiResponseId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      setIsSubmitted(true);
      toast.success("Thank you for your feedback!");

      // Close after showing success
      setTimeout(() => {
        setIsOpen(false);
      }, 1500);
    } catch (error) {
      console.error("Feedback submission error:", error);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = () => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-1 transition-transform hover:scale-110 focus:outline-none"
            aria-label={`Rate ${star} stars`}
          >
            <Star
              className={`h-8 w-8 transition-colors ${
                star <= (hoverRating || rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const getRatingText = () => {
    const texts = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];
    return texts[hoverRating || rating] || "Select a rating";
  };

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90"
        size="icon"
        title="Send Feedback"
      >
        <MessageSquarePlus className="h-6 w-6" />
      </Button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <Card className="relative w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>

            {isSubmitted ? (
              // Success State
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Thank You!</h3>
                <p className="text-muted-foreground">
                  Your feedback helps us improve MGR Capital Assistance.
                </p>
              </div>
            ) : (
              // Form State
              <>
                <h3 className="text-xl font-semibold mb-2">Send Feedback</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Help us improve by sharing your experience
                </p>

                {/* Rating */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">
                    How would you rate your experience?
                  </label>
                  <div className="flex flex-col items-center gap-2">
                    {renderStars()}
                    <span
                      className={`text-sm font-medium ${
                        rating > 0 ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {getRatingText()}
                    </span>
                  </div>
                </div>

                {/* Category */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {FEEDBACK_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Feature Display */}
                {feature && (
                  <div className="mb-4 p-2 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground">Feature: </span>
                    <span className="text-sm font-medium">{feature}</span>
                  </div>
                )}

                {/* Comment */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">
                    Comments (optional)
                  </label>
                  <Textarea
                    placeholder="Tell us more about your experience..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    maxLength={1000}
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-right">
                    {comment.length}/1000
                  </p>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={rating === 0 || isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Feedback
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  Your feedback is anonymous and helps improve the platform.
                </p>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

export default FeedbackButton;
