"use client";

import { useState, useEffect } from "react";
import Joyride, { Step, CallBackProps, STATUS } from "react-joyride";

interface OnboardingTourProps {
  role: "FOUNDER" | "ADMIN" | "HR" | "COMPLIANCE" | "TEAM_LEAD" | "EMPLOYEE" | "CLIENT";
  onComplete?: () => void;
}

const TOUR_COMPLETED_KEY = "mgr_onboarding_completed";

// Role-specific tour steps
const getTourSteps = (role: string): Step[] => {
  const baseSteps: Step[] = [
    {
      target: "body",
      content: "Welcome to MGR Capital Assistance! Let's take a quick tour to help you get started.",
      placement: "center",
      disableBeacon: true,
    },
  ];

  const founderSteps: Step[] = [
    {
      target: '[data-tour="dashboard"]',
      content: "Your Dashboard shows key metrics, active cases, and system health at a glance.",
      placement: "right",
    },
    {
      target: '[data-tour="cases"]',
      content: "Manage all your cases here. Filter by status, employee, or jurisdiction.",
      placement: "right",
    },
    {
      target: '[data-tour="ops"]',
      content: "The Ops Dashboard shows analytics, forecasts, bot performance, and system monitoring.",
      placement: "right",
    },
    {
      target: '[data-tour="comms"]',
      content: "Comms Chamber is your internal communication hub. Create channels for teams or cases.",
      placement: "right",
    },
    {
      target: '[data-tour="config"]',
      content: "Configure system settings, training modules, and operational parameters here.",
      placement: "right",
    },
  ];

  const adminSteps: Step[] = [
    {
      target: '[data-tour="dashboard"]',
      content: "Your Dashboard shows key metrics and case statistics.",
      placement: "right",
    },
    {
      target: '[data-tour="cases"]',
      content: "View and manage cases assigned to your team.",
      placement: "right",
    },
    {
      target: '[data-tour="employees"]',
      content: "Manage employee profiles, performance, and tier progression.",
      placement: "right",
    },
    {
      target: '[data-tour="training"]',
      content: "Monitor training progress and assign modules to employees.",
      placement: "right",
    },
  ];

  const employeeSteps: Step[] = [
    {
      target: '[data-tour="my-cases"]',
      content: "View your assigned cases here. Track progress and update status.",
      placement: "right",
    },
    {
      target: '[data-tour="training"]',
      content: "Complete training modules to improve your skills and advance your tier.",
      placement: "right",
    },
    {
      target: '[data-tour="earnings"]',
      content: "Track your earnings and commission on completed cases.",
      placement: "right",
    },
    {
      target: '[data-tour="comms"]',
      content: "Communicate with your team and get updates on important announcements.",
      placement: "right",
    },
  ];

  const hrSteps: Step[] = [
    {
      target: '[data-tour="hr-dashboard"]',
      content: "Your HR Dashboard shows employee metrics and onboarding status.",
      placement: "right",
    },
    {
      target: '[data-tour="onboarding"]',
      content: "Manage the employee onboarding pipeline from application to approval.",
      placement: "right",
    },
    {
      target: '[data-tour="performance"]',
      content: "Monitor employee performance and training compliance.",
      placement: "right",
    },
  ];

  const complianceSteps: Step[] = [
    {
      target: '[data-tour="compliance-dashboard"]',
      content: "Your Compliance Dashboard shows audit logs and risk assessments.",
      placement: "right",
    },
    {
      target: '[data-tour="audit-logs"]',
      content: "Review all system activity and flag suspicious actions.",
      placement: "right",
    },
    {
      target: '[data-tour="risk"]',
      content: "Monitor risk levels across security, financial, and operational areas.",
      placement: "right",
    },
  ];

  const clientSteps: Step[] = [
    {
      target: '[data-tour="case-status"]',
      content: "Track the status of your case here. We'll update you as it progresses.",
      placement: "bottom",
    },
    {
      target: '[data-tour="documents"]',
      content: "Upload required documents and sign agreements securely.",
      placement: "bottom",
    },
    {
      target: '[data-tour="faq"]',
      content: "Have questions? Check our FAQ for answers to common questions.",
      placement: "bottom",
    },
  ];

  const completionStep: Step = {
    target: "body",
    content: "You're all set! Click anywhere to start using MGR Capital Assistance.",
    placement: "center",
  };

  switch (role) {
    case "FOUNDER":
      return [...baseSteps, ...founderSteps, completionStep];
    case "ADMIN":
      return [...baseSteps, ...adminSteps, completionStep];
    case "HR":
      return [...baseSteps, ...hrSteps, completionStep];
    case "COMPLIANCE":
      return [...baseSteps, ...complianceSteps, completionStep];
    case "EMPLOYEE":
    case "TEAM_LEAD":
      return [...baseSteps, ...employeeSteps, completionStep];
    case "CLIENT":
      return [...baseSteps, ...clientSteps, completionStep];
    default:
      return [...baseSteps, completionStep];
  }
};

export function OnboardingTour({ role, onComplete }: OnboardingTourProps) {
  const [run, setRun] = useState(false);
  const [steps] = useState<Step[]>(() => getTourSteps(role));

  useEffect(() => {
    // Check if tour has been completed
    const completedRoles = localStorage.getItem(TOUR_COMPLETED_KEY);
    const completed = completedRoles ? JSON.parse(completedRoles) : {};

    if (!completed[role]) {
      // Small delay to let the page render first
      const timer = setTimeout(() => setRun(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [role]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      // Mark tour as completed for this role
      const completedRoles = localStorage.getItem(TOUR_COMPLETED_KEY);
      const completed = completedRoles ? JSON.parse(completedRoles) : {};
      completed[role] = true;
      localStorage.setItem(TOUR_COMPLETED_KEY, JSON.stringify(completed));

      setRun(false);
      onComplete?.();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: "#2563eb",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 8,
          padding: 20,
        },
        buttonNext: {
          backgroundColor: "#2563eb",
          borderRadius: 6,
          padding: "10px 20px",
        },
        buttonBack: {
          marginRight: 10,
        },
        buttonSkip: {
          color: "#64748b",
        },
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Get Started",
        next: "Next",
        skip: "Skip Tour",
      }}
    />
  );
}

// Hook to manually trigger the tour
export function useOnboardingTour(role: string) {
  const resetTour = () => {
    const completedRoles = localStorage.getItem(TOUR_COMPLETED_KEY);
    const completed = completedRoles ? JSON.parse(completedRoles) : {};
    delete completed[role];
    localStorage.setItem(TOUR_COMPLETED_KEY, JSON.stringify(completed));
    window.location.reload();
  };

  const isTourCompleted = () => {
    const completedRoles = localStorage.getItem(TOUR_COMPLETED_KEY);
    const completed = completedRoles ? JSON.parse(completedRoles) : {};
    return !!completed[role];
  };

  return { resetTour, isTourCompleted };
}

export default OnboardingTour;
