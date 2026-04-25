package api

import (
	"reflect"
	"testing"
)

func TestNormalizeBriefingType(t *testing.T) {
	tests := map[string]string{
		"Briefing": "Briefing",
		"notice":   "Notice",
		"RESPONSE": "Response",
	}

	for input, want := range tests {
		got, err := normalizeBriefingType(input)
		if err != nil {
			t.Fatalf("normalizeBriefingType(%q) returned error: %v", input, err)
		}
		if got != want {
			t.Fatalf("normalizeBriefingType(%q) = %q, want %q", input, got, want)
		}
	}

	if _, err := normalizeBriefingType("memo"); err == nil {
		t.Fatal("expected unsupported briefing type to fail")
	}
}

func TestNormalizeBriefingSectors(t *testing.T) {
	got, err := normalizeBriefingSectors([]string{"roads", "Water", " roads "})
	if err != nil {
		t.Fatalf("normalizeBriefingSectors returned error: %v", err)
	}

	want := []string{"Roads", "Water"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("normalizeBriefingSectors = %#v, want %#v", got, want)
	}

	defaulted, err := normalizeBriefingSectors(nil)
	if err != nil {
		t.Fatalf("normalizeBriefingSectors(nil) returned error: %v", err)
	}
	if !reflect.DeepEqual(defaulted, []string{"Other"}) {
		t.Fatalf("normalizeBriefingSectors(nil) = %#v, want %#v", defaulted, []string{"Other"})
	}

	if _, err := normalizeBriefingSectors([]string{"Fraud"}); err == nil {
		t.Fatal("expected unsupported sector to fail")
	}
}
