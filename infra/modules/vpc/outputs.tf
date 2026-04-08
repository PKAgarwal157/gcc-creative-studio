# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

output "network_id" {
  value       = google_compute_network.vpc.id
  description = "The ID of the VPC network"
}

output "network_name" {
  value       = google_compute_network.vpc.name
  description = "The name of the VPC network"
}

output "subnet_name" {
  value       = google_compute_subnetwork.subnet.name
  description = "The name of the subnet"
}

output "peering_connection" {
  value       = google_service_networking_connection.private_vpc_connection
  description = "The peering connection resource (used for dependencies)"
}
