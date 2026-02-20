import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl, apiFetch } from '@/lib/api';
import { Check, AlertCircle, Lock, Loader2, ChevronRight, ChevronLeft, LogOut } from 'lucide-react';

interface FormData {
    // Step 1: Identity Verification (Immutable)
    fullName: string;
    fullNameConfirm: string;
    barCouncilNumber: string;
    barCouncilNumberConfirm: string;
    identityConfirmed: boolean;

    // Step 2: Currency Selection (Immutable)
    currency: string;
    currencyConfirm: string;

    // Step 3: Professional Details (Editable)
    lawFirmName: string;
    practiceAreas: string[];
    courtLevels: string[];

    // Step 4: Contact Information
    phoneNumber: string;
    address: string;
    city: string;
    state: string;
    country: string;

    // Step 5: Preferences
    timezone: string;
}

interface FormErrors {
    [key: string]: string;
}

const PRACTICE_AREAS = ['Civil', 'Criminal', 'Corporate', 'Family', 'Tax', 'Property'];
const COURT_LEVELS = ['District Court', 'High Court', 'Supreme Court'];
const CURRENCIES = [
    { value: 'INR', label: '₹ INR - Indian Rupee' },
    { value: 'USD', label: '$ USD - US Dollar' },
    { value: 'EUR', label: '€ EUR - Euro' },
    { value: 'GBP', label: '£ GBP - British Pound' },
    { value: 'AED', label: 'د.إ AED - UAE Dirham' },
];

const Onboarding = () => {
    const { user, refreshUser, logout } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAborting, setIsAborting] = useState(false);
    const [finalConfirmed, setFinalConfirmed] = useState(false);

    const [formData, setFormData] = useState<FormData>({
        fullName: '',
        fullNameConfirm: '',
        barCouncilNumber: '',
        barCouncilNumberConfirm: '',
        identityConfirmed: false,
        currency: '',
        currencyConfirm: '',
        lawFirmName: '',
        practiceAreas: [],
        courtLevels: [],
        phoneNumber: '',
        address: '',
        city: '',
        state: '',
        country: '',
        timezone: 'Asia/Kolkata',
    });

    const [errors, setErrors] = useState<FormErrors>({});

    const updateField = (field: keyof FormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const toggleArrayField = (field: 'practiceAreas' | 'courtLevels', value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].includes(value)
                ? prev[field].filter(v => v !== value)
                : [...prev[field], value]
        }));
    };

    const validateStep1 = (): boolean => {
        const newErrors: FormErrors = {};
        if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
        if (!formData.fullNameConfirm.trim()) newErrors.fullNameConfirm = 'Please confirm your full name';
        else if (formData.fullName !== formData.fullNameConfirm) newErrors.fullNameConfirm = 'Names do not match';

        if (!formData.barCouncilNumber.trim()) newErrors.barCouncilNumber = 'Bar Council Number is required';
        if (!formData.barCouncilNumberConfirm.trim()) newErrors.barCouncilNumberConfirm = 'Please confirm your Bar Council Number';
        else if (formData.barCouncilNumber !== formData.barCouncilNumberConfirm) newErrors.barCouncilNumberConfirm = 'Bar Council Numbers do not match';

        if (!formData.identityConfirmed) newErrors.identityConfirmed = 'You must confirm this information is correct';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = (): boolean => {
        const newErrors: FormErrors = {};
        if (!formData.currency) newErrors.currency = 'Currency is required';
        if (!formData.currencyConfirm) newErrors.currencyConfirm = 'Please confirm your currency selection';
        else if (formData.currency !== formData.currencyConfirm) newErrors.currencyConfirm = 'Currency selections do not match';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (currentStep === 1 && !validateStep1()) return;
        if (currentStep === 2 && !validateStep2()) return;
        setCurrentStep(prev => prev + 1);
    };

    const handlePrevious = () => {
        setCurrentStep(prev => prev - 1);
    };

    const handleSkip = () => {
        setCurrentStep(prev => prev + 1);
    };

    const handleSubmit = async () => {
        if (!finalConfirmed) {
            toast({
                title: 'Confirmation Required',
                description: 'Please confirm that the information is correct before completing setup.',
                variant: 'destructive'
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await apiFetch(getApiUrl('/api/v1/auth/complete-onboarding'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to complete onboarding');

            await refreshUser();
            toast({
                title: '✓ Onboarding Complete',
                description: 'Welcome to LawGPT! Your profile has been set up successfully.'
            });
            navigate('/dashboard');
        } catch (error: any) {
            toast({
                title: 'Setup Failed',
                description: error.message || 'Failed to complete onboarding',
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAbortOnboarding = async () => {
        setIsAborting(true);
        try {
            await logout();
            toast({
                title: 'Onboarding Aborted',
                description: 'You have been logged out. You can complete onboarding later.'
            });
            navigate('/login');
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to abort onboarding',
                variant: 'destructive'
            });
        } finally {
            setIsAborting(false);
        }
    };

    const steps = [
        { number: 1, title: 'Identity' },
        { number: 2, title: 'Currency' },
        { number: 3, title: 'Professional' },
        { number: 4, title: 'Contact' },
        { number: 5, title: 'Preferences' },
        { number: 6, title: 'Confirm' },
    ];

    return (
        <div className="min-h-screen bg-background/95 backdrop-blur-md flex items-center justify-center p-4">
            <Card className="w-full max-w-3xl shadow-2xl border-2">
                <CardHeader className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-3xl font-bold">Welcome to LawGPT</CardTitle>
                            <CardDescription className="text-base mt-2">Complete your secure profile setup to get started</CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="default"
                            onClick={handleAbortOnboarding}
                            disabled={isSubmitting || isAborting}
                            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground font-semibold"
                        >
                            {isAborting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Aborting...
                                </>
                            ) : (
                                <>
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Abort Onboarding
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Progress Indicator */}
                    <div className="flex items-center justify-between">
                        {steps.map((step, index) => (
                            <div key={step.number} className="flex items-center flex-1">
                                <div className="flex flex-col items-center w-full">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${currentStep > step.number
                                        ? 'bg-primary text-primary-foreground'
                                        : currentStep === step.number
                                            ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110'
                                            : 'bg-muted text-muted-foreground'
                                        }`}>
                                        {currentStep > step.number ? <Check className="h-5 w-5" /> : step.number}
                                    </div>
                                    <span className="text-xs mt-2 text-center font-medium">{step.title}</span>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`flex-1 h-1 mx-1 rounded transition-all ${currentStep > step.number ? 'bg-primary' : 'bg-muted'
                                        }`} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Step Counter */}
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground font-medium">Step {currentStep} of {steps.length}</p>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Step 1: Identity Verification */}
                    {currentStep === 1 && (
                        <div className="space-y-5">
                            <Alert className="border-amber-500 bg-amber-500/10">
                                <Lock className="h-4 w-4 text-amber-600" />
                                <AlertDescription className="text-sm font-medium">
                                    <strong>Important:</strong> This information cannot be changed later. Please verify carefully.
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="fullName" className="flex items-center gap-2">
                                        Full Name <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Label>
                                    <Input
                                        id="fullName"
                                        value={formData.fullName}
                                        onChange={(e) => updateField('fullName', e.target.value)}
                                        placeholder="Enter your full legal name"
                                        className={errors.fullName ? 'border-destructive' : ''}
                                    />
                                    {errors.fullName && <p className="text-sm text-destructive mt-1">{errors.fullName}</p>}
                                </div>

                                <div>
                                    <Label htmlFor="fullNameConfirm">Confirm Full Name</Label>
                                    <Input
                                        id="fullNameConfirm"
                                        value={formData.fullNameConfirm}
                                        onChange={(e) => updateField('fullNameConfirm', e.target.value)}
                                        placeholder="Re-enter your full legal name"
                                        className={errors.fullNameConfirm ? 'border-destructive' : ''}
                                    />
                                    {errors.fullNameConfirm && <p className="text-sm text-destructive mt-1">{errors.fullNameConfirm}</p>}
                                </div>

                                <div>
                                    <Label htmlFor="barCouncilNumber" className="flex items-center gap-2">
                                        Bar Council Number <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Label>
                                    <Input
                                        id="barCouncilNumber"
                                        value={formData.barCouncilNumber}
                                        onChange={(e) => updateField('barCouncilNumber', e.target.value)}
                                        placeholder="Enter your bar registration number"
                                        className={errors.barCouncilNumber ? 'border-destructive' : ''}
                                    />
                                    {errors.barCouncilNumber && <p className="text-sm text-destructive mt-1">{errors.barCouncilNumber}</p>}
                                </div>

                                <div>
                                    <Label htmlFor="barCouncilNumberConfirm">Confirm Bar Council Number</Label>
                                    <Input
                                        id="barCouncilNumberConfirm"
                                        value={formData.barCouncilNumberConfirm}
                                        onChange={(e) => updateField('barCouncilNumberConfirm', e.target.value)}
                                        placeholder="Re-enter your bar registration number"
                                        className={errors.barCouncilNumberConfirm ? 'border-destructive' : ''}
                                    />
                                    {errors.barCouncilNumberConfirm && <p className="text-sm text-destructive mt-1">{errors.barCouncilNumberConfirm}</p>}
                                </div>

                                <div className="flex items-start space-x-3 pt-2">
                                    <Checkbox
                                        id="identityConfirmed"
                                        checked={formData.identityConfirmed}
                                        onCheckedChange={(checked) => updateField('identityConfirmed', checked)}
                                    />
                                    <label htmlFor="identityConfirmed" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        I confirm this information is correct and permanent. I understand it cannot be changed later.
                                    </label>
                                </div>
                                {errors.identityConfirmed && <p className="text-sm text-destructive">{errors.identityConfirmed}</p>}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Currency Selection */}
                    {currentStep === 2 && (
                        <div className="space-y-5">
                            <Alert className="border-amber-500 bg-amber-500/10">
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                <AlertDescription className="text-sm font-medium">
                                    <strong>Warning:</strong> This currency will be used across billing and financial calculations. It cannot be changed later.
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="currency" className="flex items-center gap-2">
                                        Currency <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Label>
                                    <Select value={formData.currency} onValueChange={(value) => updateField('currency', value)}>
                                        <SelectTrigger className={errors.currency ? 'border-destructive' : ''}>
                                            <SelectValue placeholder="Select your currency" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CURRENCIES.map(curr => (
                                                <SelectItem key={curr.value} value={curr.value}>{curr.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.currency && <p className="text-sm text-destructive mt-1">{errors.currency}</p>}
                                </div>

                                <div>
                                    <Label htmlFor="currencyConfirm">Confirm Currency</Label>
                                    <Select value={formData.currencyConfirm} onValueChange={(value) => updateField('currencyConfirm', value)}>
                                        <SelectTrigger className={errors.currencyConfirm ? 'border-destructive' : ''}>
                                            <SelectValue placeholder="Confirm your currency selection" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CURRENCIES.map(curr => (
                                                <SelectItem key={curr.value} value={curr.value}>{curr.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.currencyConfirm && <p className="text-sm text-destructive mt-1">{errors.currencyConfirm}</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Professional Details */}
                    {currentStep === 3 && (
                        <div className="space-y-5">
                            <Alert>
                                <AlertDescription className="text-sm">
                                    These details can be updated later from your profile settings.
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="lawFirmName">Law Firm / Practice Name (Optional)</Label>
                                    <Input
                                        id="lawFirmName"
                                        value={formData.lawFirmName}
                                        onChange={(e) => updateField('lawFirmName', e.target.value)}
                                        placeholder="Enter your firm name"
                                    />
                                </div>

                                <div>
                                    <Label>Practice Areas (Optional)</Label>
                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                        {PRACTICE_AREAS.map(area => (
                                            <div key={area} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`practice-${area}`}
                                                    checked={formData.practiceAreas.includes(area)}
                                                    onCheckedChange={() => toggleArrayField('practiceAreas', area)}
                                                />
                                                <label htmlFor={`practice-${area}`} className="text-sm font-medium leading-none">
                                                    {area}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <Label>Court Levels (Optional)</Label>
                                    <div className="grid grid-cols-1 gap-3 mt-2">
                                        {COURT_LEVELS.map(level => (
                                            <div key={level} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`court-${level}`}
                                                    checked={formData.courtLevels.includes(level)}
                                                    onCheckedChange={() => toggleArrayField('courtLevels', level)}
                                                />
                                                <label htmlFor={`court-${level}`} className="text-sm font-medium leading-none">
                                                    {level}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Contact Information */}
                    {currentStep === 4 && (
                        <div className="space-y-5">
                            <Alert>
                                <AlertDescription className="text-sm">
                                    All fields are optional. You can skip this step or update later.
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="phoneNumber">Phone Number</Label>
                                    <Input
                                        id="phoneNumber"
                                        value={formData.phoneNumber}
                                        onChange={(e) => updateField('phoneNumber', e.target.value)}
                                        placeholder="+91 XXXXX XXXXX"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="address">Address</Label>
                                    <Input
                                        id="address"
                                        value={formData.address}
                                        onChange={(e) => updateField('address', e.target.value)}
                                        placeholder="Street address"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="city">City</Label>
                                        <Input
                                            id="city"
                                            value={formData.city}
                                            onChange={(e) => updateField('city', e.target.value)}
                                            placeholder="City"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="state">State</Label>
                                        <Input
                                            id="state"
                                            value={formData.state}
                                            onChange={(e) => updateField('state', e.target.value)}
                                            placeholder="State"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="country">Country</Label>
                                    <Input
                                        id="country"
                                        value={formData.country}
                                        onChange={(e) => updateField('country', e.target.value)}
                                        placeholder="Country"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Preferences */}
                    {currentStep === 5 && (
                        <div className="space-y-5">
                            <Alert>
                                <AlertDescription className="text-sm">
                                    Set your preferences. These can be changed anytime from settings.
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="timezone">Timezone</Label>
                                    <Select value={formData.timezone} onValueChange={(value) => updateField('timezone', value)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                                            <SelectItem value="America/New_York">America/New York (EST)</SelectItem>
                                            <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                                            <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                                            <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 6: Confirmation */}
                    {currentStep === 6 && (
                        <div className="space-y-5">
                            <Alert className="border-primary bg-primary/10">
                                <Check className="h-4 w-4 text-primary" />
                                <AlertDescription className="text-sm font-medium">
                                    Please review your information carefully before completing setup.
                                </AlertDescription>
                            </Alert>

                            <div className="bg-muted p-6 rounded-lg space-y-4">
                                <div className="border-b pb-3">
                                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                        Immutable Fields <Lock className="h-4 w-4 text-amber-600" />
                                    </h3>
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Full Name</p>
                                            <p className="font-medium">{formData.fullName}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Bar Council Number</p>
                                            <p className="font-medium">{formData.barCouncilNumber}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Currency</p>
                                            <p className="font-medium">
                                                {CURRENCIES.find(c => c.value === formData.currency)?.label || formData.currency}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {(formData.lawFirmName || formData.practiceAreas.length > 0 || formData.courtLevels.length > 0) && (
                                    <div className="border-b pb-3">
                                        <h3 className="font-semibold mb-2">Professional Details</h3>
                                        {formData.lawFirmName && (
                                            <div>
                                                <p className="text-sm text-muted-foreground">Law Firm</p>
                                                <p className="font-medium">{formData.lawFirmName}</p>
                                            </div>
                                        )}
                                        {formData.practiceAreas.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-sm text-muted-foreground">Practice Areas</p>
                                                <p className="font-medium">{formData.practiceAreas.join(', ')}</p>
                                            </div>
                                        )}
                                        {formData.courtLevels.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-sm text-muted-foreground">Court Levels</p>
                                                <p className="font-medium">{formData.courtLevels.join(', ')}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(formData.phoneNumber || formData.address || formData.city) && (
                                    <div>
                                        <h3 className="font-semibold mb-2">Contact Information</h3>
                                        {formData.phoneNumber && (
                                            <div>
                                                <p className="text-sm text-muted-foreground">Phone</p>
                                                <p className="font-medium">{formData.phoneNumber}</p>
                                            </div>
                                        )}
                                        {formData.address && (
                                            <div className="mt-2">
                                                <p className="text-sm text-muted-foreground">Address</p>
                                                <p className="font-medium">
                                                    {formData.address}
                                                    {formData.city && `, ${formData.city}`}
                                                    {formData.state && `, ${formData.state}`}
                                                    {formData.country && `, ${formData.country}`}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <Alert className="border-destructive bg-destructive/10">
                                <AlertCircle className="h-4 w-4 text-destructive" />
                                <AlertDescription className="text-sm font-medium">
                                    <strong>Warning:</strong> Full Name, Bar Council Number, and Currency cannot be changed in future.
                                </AlertDescription>
                            </Alert>

                            <div className="flex items-start space-x-3 pt-2">
                                <Checkbox
                                    id="finalConfirmed"
                                    checked={finalConfirmed}
                                    onCheckedChange={(checked) => setFinalConfirmed(checked as boolean)}
                                />
                                <label htmlFor="finalConfirmed" className="text-sm font-medium leading-none">
                                    I have reviewed all information and confirm it is accurate. I understand that immutable fields cannot be changed.
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between pt-6 border-t">
                        <Button
                            variant="outline"
                            onClick={handlePrevious}
                            disabled={currentStep === 1 || isSubmitting}
                            className="gap-2"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Button>

                        <div className="flex gap-2">
                            {(currentStep === 3 || currentStep === 4 || currentStep === 5) && (
                                <Button
                                    variant="ghost"
                                    onClick={handleSkip}
                                    disabled={isSubmitting}
                                >
                                    Skip
                                </Button>
                            )}

                            {currentStep < 6 ? (
                                <Button onClick={handleNext} className="gap-2">
                                    Next Step
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            ) : (
                                <Button onClick={handleSubmit} disabled={isSubmitting || !finalConfirmed} className="gap-2">
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Completing Setup...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4" />
                                            Complete Setup
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Onboarding;
