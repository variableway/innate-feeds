package api

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// CORSMiddleware returns a gin middleware that configures CORS to allow
// all origins, methods, and headers for API accessibility.
func CORSMiddleware() gin.HandlerFunc {
	return cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	})
}

// ErrorRecovery returns a middleware that recovers from panics, logs the
// error, and returns a JSON 500 response.
func ErrorRecovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("panic recovered in HTTP handler",
					"error", fmt.Sprintf("%v", r),
					"path", c.Request.URL.Path,
					"method", c.Request.Method,
				)
				c.JSON(500, Response{
					Error: "internal server error",
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}

// RequestLogger returns a middleware that logs each incoming request with
// its method, path, status code, and duration.
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery
		if raw != "" {
			path = path + "?" + raw
		}

		c.Next()

		duration := time.Since(start)
		status := c.Writer.Status()

		slog.Info("http request",
			"method", c.Request.Method,
			"path", path,
			"status", status,
			"duration", duration.Milliseconds(),
			"client_ip", c.ClientIP(),
			"errors", c.Errors.String(),
		)
	}
}
