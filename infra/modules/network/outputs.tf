output "network_id" {
  description = "The ID of the VPC network"
  value       = google_compute_network.vpc.id
}

output "network_name" {
  description = "The name of the VPC network"
  value       = google_compute_network.vpc.name
}

output "subnetwork_id" {
  description = "The ID of the subnetwork"
  value       = google_compute_subnetwork.subnet.id
}

output "private_vpc_connection_id" {
  description = "The ID of the private VPC connection"
  value       = google_service_networking_connection.private_vpc_connection.id
}
