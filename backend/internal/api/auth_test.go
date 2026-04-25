package api

import "testing"

func TestResolveRegistrationRoleDefaultsToCitizen(t *testing.T) {
	role, err := resolveRegistrationRole("", "citizen@example.com", "", "", nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if role != "citizen" {
		t.Fatalf("expected citizen role, got %q", role)
	}
}

func TestResolveRegistrationRoleRejectsOpenMPRegistration(t *testing.T) {
	_, err := resolveRegistrationRole("mp", "mp@example.com", "", "", nil)
	if err == nil {
		t.Fatal("expected invite-only error for mp registration")
	}
}

func TestResolveRegistrationRoleAllowsMPWithInviteCode(t *testing.T) {
	role, err := resolveRegistrationRole("mp", "mp@example.com", "FINAL30", "FINAL30", nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if role != "mp" {
		t.Fatalf("expected mp role, got %q", role)
	}
}

func TestResolveRegistrationRoleAllowsMPWhitelistEmail(t *testing.T) {
	role, err := resolveRegistrationRole(
		"mp",
		"hon.member@parliament.gh",
		"",
		"",
		map[string]struct{}{"hon.member@parliament.gh": {}},
	)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if role != "mp" {
		t.Fatalf("expected mp role, got %q", role)
	}
}
