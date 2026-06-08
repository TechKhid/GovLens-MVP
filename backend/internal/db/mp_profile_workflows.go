package db

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var ErrMPRoleRequiresConstituency = errors.New("mp role requires constituency")

type MPProfileSeed struct {
	Party      string
	TermStart  string
	TermEnd    string
	Bio        string
	Phone      string
	OfficeAddr string
	PhotoURL   string
}

type RegisterUserWithOptionalMPProfileParams struct {
	Name         string
	Email        string
	PasswordHash string
	Role         string
	Constituency *string
	MPProfile    *MPProfileSeed
}

type ChangeUserRoleWithLifecycleParams struct {
	ID        pgtype.UUID
	Role      string
	MPProfile *MPProfileSeed
}

const ensureActiveMPProfileQuery = `
INSERT INTO mp_profiles (
    user_id,
    party,
    term_start,
    term_end,
    bio,
    phone,
    office_addr,
    photo_url,
    profile_status,
    archived_at,
    archive_reason
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NULL, '')
ON CONFLICT (user_id) DO UPDATE
SET
    party = CASE
        WHEN EXCLUDED.party <> '' THEN EXCLUDED.party
        ELSE mp_profiles.party
    END,
    term_start = CASE
        WHEN EXCLUDED.term_start <> '' THEN EXCLUDED.term_start
        ELSE mp_profiles.term_start
    END,
    term_end = CASE
        WHEN EXCLUDED.term_end <> '' THEN EXCLUDED.term_end
        ELSE mp_profiles.term_end
    END,
    bio = CASE
        WHEN EXCLUDED.bio <> '' THEN EXCLUDED.bio
        ELSE mp_profiles.bio
    END,
    phone = CASE
        WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone
        ELSE mp_profiles.phone
    END,
    office_addr = CASE
        WHEN EXCLUDED.office_addr <> '' THEN EXCLUDED.office_addr
        ELSE mp_profiles.office_addr
    END,
    photo_url = CASE
        WHEN EXCLUDED.photo_url <> '' THEN EXCLUDED.photo_url
        ELSE mp_profiles.photo_url
    END,
    profile_status = 'active',
    archived_at = NULL,
    archive_reason = '',
    updated_at = NOW()
`

const archiveMPProfileQuery = `
UPDATE mp_profiles
SET
    profile_status = 'archived',
    archived_at = NOW(),
    archive_reason = $2,
    updated_at = NOW()
WHERE user_id = $1
  AND profile_status <> 'archived'
`

func (s *Store) RegisterUserWithOptionalMPProfile(ctx context.Context, arg RegisterUserWithOptionalMPProfileParams) (User, error) {
	if s == nil || s.Primary == nil || s.Queries == nil {
		return User{}, fmt.Errorf("database unavailable")
	}

	tx, err := s.Primary.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return User{}, err
	}
	defer tx.Rollback(ctx)

	q := s.Queries.WithTx(tx)
	role := strings.ToLower(strings.TrimSpace(arg.Role))
	if role == "mp" && !hasConstituency(arg.Constituency) {
		return User{}, ErrMPRoleRequiresConstituency
	}

	user, err := q.CreateUser(ctx, CreateUserParams{
		Name:         arg.Name,
		Email:        arg.Email,
		PasswordHash: arg.PasswordHash,
		Role:         role,
		Constituency: arg.Constituency,
	})
	if err != nil {
		return User{}, err
	}

	if role == "mp" {
		if err := ensureActiveMPProfile(ctx, tx, user.ID, normalizeMPProfileSeed(arg.MPProfile)); err != nil {
			return User{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return User{}, err
	}

	return user, nil
}

func (s *Store) ChangeUserRoleWithLifecycle(ctx context.Context, arg ChangeUserRoleWithLifecycleParams) (UpdateUserRoleRow, error) {
	if s == nil || s.Primary == nil || s.Queries == nil {
		return UpdateUserRoleRow{}, fmt.Errorf("database unavailable")
	}

	tx, err := s.Primary.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return UpdateUserRoleRow{}, err
	}
	defer tx.Rollback(ctx)

	q := s.Queries.WithTx(tx)
	targetRole := strings.ToLower(strings.TrimSpace(arg.Role))

	currentUser, err := q.GetUserByID(ctx, arg.ID)
	if err != nil {
		return UpdateUserRoleRow{}, err
	}

	if currentUser.Role != "mp" && targetRole == "mp" && !hasConstituency(currentUser.Constituency) {
		return UpdateUserRoleRow{}, ErrMPRoleRequiresConstituency
	}

	updated, err := q.UpdateUserRole(ctx, UpdateUserRoleParams{
		ID:   arg.ID,
		Role: targetRole,
	})
	if err != nil {
		return UpdateUserRoleRow{}, err
	}

	switch targetRole {
	case "mp":
		if err := ensureActiveMPProfile(ctx, tx, arg.ID, normalizeMPProfileSeed(arg.MPProfile)); err != nil {
			return UpdateUserRoleRow{}, err
		}
	default:
		if currentUser.Role == "mp" {
			if err := archiveMPProfile(ctx, tx, arg.ID, archiveReasonForRole(targetRole)); err != nil {
				return UpdateUserRoleRow{}, err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return UpdateUserRoleRow{}, err
	}

	return updated, nil
}

func ensureActiveMPProfile(ctx context.Context, tx pgx.Tx, userID pgtype.UUID, seed MPProfileSeed) error {
	_, err := tx.Exec(
		ctx,
		ensureActiveMPProfileQuery,
		userID,
		seed.Party,
		seed.TermStart,
		seed.TermEnd,
		seed.Bio,
		seed.Phone,
		seed.OfficeAddr,
		seed.PhotoURL,
	)
	return err
}

func archiveMPProfile(ctx context.Context, tx pgx.Tx, userID pgtype.UUID, reason string) error {
	_, err := tx.Exec(ctx, archiveMPProfileQuery, userID, reason)
	return err
}

func normalizeMPProfileSeed(seed *MPProfileSeed) MPProfileSeed {
	if seed == nil {
		return MPProfileSeed{}
	}

	return MPProfileSeed{
		Party:      strings.TrimSpace(seed.Party),
		TermStart:  strings.TrimSpace(seed.TermStart),
		TermEnd:    strings.TrimSpace(seed.TermEnd),
		Bio:        strings.TrimSpace(seed.Bio),
		Phone:      strings.TrimSpace(seed.Phone),
		OfficeAddr: strings.TrimSpace(seed.OfficeAddr),
		PhotoURL:   strings.TrimSpace(seed.PhotoURL),
	}
}

func hasConstituency(constituency *string) bool {
	return constituency != nil && strings.TrimSpace(*constituency) != ""
}

func archiveReasonForRole(role string) string {
	role = strings.TrimSpace(role)
	if role == "" {
		return "role_changed"
	}
	return "role_changed_to_" + role
}
