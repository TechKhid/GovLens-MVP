package api

import "testing"

func TestNormalizeIssueStatusInput(t *testing.T) {
	tests := map[string]string{
		"Reported":             "open",
		"acknowledged":         "acknowledged",
		"In Progress":          "in-progress",
		"pending verification": "pending-verification",
		"Verified Resolved":    "verified-resolved",
		"reopened":             "reopened",
	}

	for input, want := range tests {
		if got := normalizeIssueStatusInput(input); got != want {
			t.Fatalf("normalizeIssueStatusInput(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestValidateIssueStatusChangeForMP(t *testing.T) {
	if _, err := validateIssueStatusChange("mp", "acknowledged", ""); err != nil {
		t.Fatalf("expected mp to acknowledge issue, got %v", err)
	}

	if _, err := validateIssueStatusChange("mp", "pending verification", ""); err == nil {
		t.Fatal("expected pending verification to require a note")
	}

	if _, err := validateIssueStatusChange("mp", "verified resolved", "fixed"); err == nil {
		t.Fatal("expected mp to be blocked from verified resolved")
	}
}

func TestValidateIssueStatusChangeForAdmin(t *testing.T) {
	status, err := validateIssueStatusChange("admin", "verified resolved", "")
	if err != nil {
		t.Fatalf("expected admin transition to succeed, got %v", err)
	}
	if status != "verified-resolved" {
		t.Fatalf("expected verified-resolved, got %q", status)
	}
}

func TestValidateIssueVerificationAction(t *testing.T) {
	action, err := validateIssueVerificationAction("confirm")
	if err != nil {
		t.Fatalf("expected confirm to pass, got %v", err)
	}
	if action != "confirm" {
		t.Fatalf("expected confirm action, got %q", action)
	}

	if _, err := validateIssueVerificationAction("maybe"); err == nil {
		t.Fatal("expected invalid verification action to fail")
	}
}

func TestNormalizeIssueSeverityInput(t *testing.T) {
	tests := map[string]string{
		"low":      "low",
		"Medium":   "medium",
		"HIGH":     "high",
		"critical": "critical",
	}

	for input, want := range tests {
		got, err := normalizeIssueSeverityInput(input)
		if err != nil {
			t.Fatalf("normalizeIssueSeverityInput(%q) returned error: %v", input, err)
		}
		if got != want {
			t.Fatalf("normalizeIssueSeverityInput(%q) = %q, want %q", input, got, want)
		}
	}

	if _, err := normalizeIssueSeverityInput("severe"); err == nil {
		t.Fatal("expected invalid severity to fail")
	}
}
