resource "google_compute_region_network_endpoint_group" "serverless_neg" {
  name                  = "cs-${var.environment}-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.gcp_region
  project               = var.gcp_project_id
  cloud_run {
    service = module.backend_service.service_name
  }
}

resource "google_compute_backend_service" "default" {
  name        = "cs-${var.environment}-backend-service"
  port_name   = "http"
  protocol    = "HTTP"
  timeout_sec = 30
  project     = var.gcp_project_id

  backend {
    group = google_compute_region_network_endpoint_group.serverless_neg.id
  }
}

resource "google_compute_url_map" "default" {
  name            = "cs-${var.environment}-url-map"
  default_service = google_compute_backend_service.default.id
  project         = var.gcp_project_id
}

resource "google_compute_target_http_proxy" "default" {
  name    = "cs-${var.environment}-target-proxy"
  url_map = google_compute_url_map.default.id
  project = var.gcp_project_id
}

resource "google_compute_global_forwarding_rule" "default" {
  name       = "cs-${var.environment}-forwarding-rule"
  target     = google_compute_target_http_proxy.default.id
  port_range = "80"
  project    = var.gcp_project_id
}

output "load_balancer_ip" {
  description = "The IP address of the load balancer"
  value       = google_compute_global_forwarding_rule.default.ip_address
}
