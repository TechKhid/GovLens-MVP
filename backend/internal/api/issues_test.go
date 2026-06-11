package api

import (
	"strings"
	"testing"

	"github.com/govlens/govlens-mvp/backend/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
)

func testUUID(t *testing.T, value string) pgtype.UUID {
	t.Helper()

	var id pgtype.UUID
	if err := id.Scan(value); err != nil {
		t.Fatalf("failed to scan test UUID: %v", err)
	}
	return id
}

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

func TestValidateIssueVerificationEligibilityAllowsOriginalReporterWithNormalizedPendingStatus(t *testing.T) {
	reporterID := testUUID(t, "11111111-1111-1111-1111-111111111111")
	issue := db.Issue{
		UserID: reporterID,
		Status: "Pending Verification",
	}

	if err := validateIssueVerificationEligibility(issue, reporterID); err != nil {
		t.Fatalf("expected original reporter to verify pending issue, got %v", err)
	}
}

func TestValidateIssueVerificationEligibilityBlocksNonReporter(t *testing.T) {
	reporterID := testUUID(t, "11111111-1111-1111-1111-111111111111")
	actorID := testUUID(t, "22222222-2222-2222-2222-222222222222")
	issue := db.Issue{
		UserID: reporterID,
		Status: "pending-verification",
	}

	err := validateIssueVerificationEligibility(issue, actorID)
	if err == nil || !strings.Contains(err.Error(), "original reporter") {
		t.Fatalf("expected non-reporter to be blocked, got %v", err)
	}
}

func TestValidateIssueVerificationEligibilityBlocksNonPendingIssue(t *testing.T) {
	reporterID := testUUID(t, "11111111-1111-1111-1111-111111111111")
	issue := db.Issue{
		UserID: reporterID,
		Status: "in-progress",
	}

	err := validateIssueVerificationEligibility(issue, reporterID)
	if err == nil || !strings.Contains(err.Error(), "awaiting citizen verification") {
		t.Fatalf("expected non-pending issue to be blocked, got %v", err)
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
