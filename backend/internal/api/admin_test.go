package api

import "testing"

func TestNormalizeManagedUserRole(t *testing.T) {
	tests := map[string]string{
		"Citizen":  "citizen",
		" mp ":     "mp",
		"SYSADMIN": "sysadmin",
	}

	for input, want := range tests {
		got, err := normalizeManagedUserRole(input)
		if err != nil {
			t.Fatalf("normalizeManagedUserRole(%q) returned error: %v", input, err)
		}
		if got != want {
			t.Fatalf("normalizeManagedUserRole(%q) = %q, want %q", input, got, want)
		}
	}

	if _, err := normalizeManagedUserRole("mayor"); err == nil {
		t.Fatal("expected unsupported role to fail")
	}
}
