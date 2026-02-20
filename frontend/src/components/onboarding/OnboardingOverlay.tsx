import OnboardingWizard from './OnboardingWizard';

/**
 * OnboardingOverlay Component
 * 
 * Renders the onboarding wizard as a fixed overlay on top of the dashboard.
 * Features:
 * - Full-screen blur backdrop
 * - Blocks dashboard interaction via pointer-events
 * - Dark mode support
 * - Highest z-index to ensure visibility
 */
const OnboardingOverlay = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Blur backdrop - blocks interaction with dashboard */}
            <div
                className="absolute inset-0 bg-background/40 dark:bg-background/40 backdrop-blur-[8px]"
                style={{ pointerEvents: 'all' }}
                aria-hidden="true"
            />

            {/* Wizard content — constrained to viewport so it never overflows */}
            <div className="relative z-10 max-w-3xl w-full mx-4 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
                <OnboardingWizard />
            </div>
        </div>
    );
};

export default OnboardingOverlay;
