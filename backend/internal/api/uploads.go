package api

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func (s *Server) uploadsRoot() string {
	if dir := os.Getenv("UPLOADS_DIR"); dir != "" {
		return dir
	}
	return filepath.Join(os.TempDir(), "govlens-uploads")
}

func (s *Server) ensureUploadsRoot() error {
	return os.MkdirAll(s.uploadsRoot(), 0o755)
}

func (s *Server) uploadedFileURL(relativePath string) string {
	trimmed := strings.TrimLeft(filepath.ToSlash(relativePath), "/")
	return fmt.Sprintf("/api/v1/uploads/%s", trimmed)
}

func (s *Server) issueImageURL(relativePath string) string {
	return s.uploadedFileURL(relativePath)
}

func (s *Server) UploadsHandler() http.Handler {
	_ = s.ensureUploadsRoot()
	fileServer := http.FileServer(http.Dir(s.uploadsRoot()))
	return http.StripPrefix("/api/v1/uploads/", fileServer)
}
