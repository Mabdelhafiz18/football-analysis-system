import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Video, Mail, Lock, User, Building2, Loader2, Check } from "lucide-react";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Register() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    clubName: "",
    role: "coach" as UserRole,
    password: "",
    confirmPassword: "",
  });
  
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 1) {
      if (!formData.email || !formData.name || !formData.password) {
        toast.error("Please fill in all required fields");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      setStep(2);
      return;
    }

    try {
      await register({
        email: formData.email,
        name: formData.name,
        clubName: formData.clubName,
        role: formData.role,
      });
      toast.success("Account created successfully!");
      navigate("/dashboard");
    } catch (error) {
      toast.error("Registration failed. Please try again.");
    }
  };

  const roles = [
    { id: "coach", title: "Coach", description: "Upload match video and view tactical analysis" },
    { id: "referee", title: "Referee", description: "Review VAR decisions and match incidents" },
    { id: "manager", title: "Manager", description: "Full access to all features and reports" },
    { id: "academy_admin", title: "Academy Admin", description: "Manage multiple teams and development" },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 grid-background opacity-20 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary lime-glow">
              <Video className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">
              Vision<span className="text-primary">VAR</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
          <p className="text-muted-foreground mt-2">Join VisionVAR and revolutionize your analysis</p>
        </div>

        <div className="glass-card rounded-2xl p-8 border-border/50">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between mb-8 px-4">
            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {step > 1 ? <Check className="h-4 w-4" /> : "1"}
              </div>
              <span className="text-xs font-medium text-muted-foreground">Account</span>
            </div>
            <div className={cn("flex-1 h-px mx-4 mb-6", step > 1 ? "bg-primary" : "bg-border")} />
            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                2
              </div>
              <span className="text-xs font-medium text-muted-foreground">Professional</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 ? (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="John Doe"
                      className="pl-10 bg-muted/30"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@club.com"
                      className="pl-10 bg-muted/30"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 bg-muted/30"
                        value={formData.password}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 bg-muted/30"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label htmlFor="clubName">Club / Organization Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="clubName"
                      placeholder="Premier Football Academy"
                      className="pl-10 bg-muted/30"
                      value={formData.clubName}
                      onChange={(e) => handleInputChange("clubName", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Select Your Role</Label>
                  <div className="grid grid-cols-1 gap-3">
                    {roles.map((role) => (
                      <div
                        key={role.id}
                        onClick={() => handleInputChange("role", role.id as UserRole)}
                        className={cn(
                          "cursor-pointer p-4 rounded-xl border transition-all duration-200",
                          formData.role === role.id 
                            ? "bg-primary/10 border-primary ring-1 ring-primary shadow-sm" 
                            : "bg-muted/30 border-border/50 hover:bg-muted/50 hover:border-border"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn(
                            "font-bold",
                            formData.role === role.id ? "text-primary" : "text-foreground"
                          )}>
                            {role.title}
                          </span>
                          {formData.role === role.id && <Check className="h-4 w-4 text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            <div className="flex items-center gap-3 pt-2">
              {step === 2 && (
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1 h-12 border-border/50" 
                  onClick={() => setStep(1)}
                  disabled={isLoading}
                >
                  Back
                </Button>
              )}
              <Button type="submit" className="flex-[2] h-12 lime-glow text-base font-bold" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  step === 1 ? "Next: Role Selection" : "Complete Registration"
                )}
              </Button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

