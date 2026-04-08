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

variable "project_id" {
  type        = string
  description = "The GCP project ID"
}

variable "region" {
  type        = string
  description = "The GCP region"
}

variable "network_name" {
  type        = string
  default     = "creative-studio-vpc"
  description = "The name of the VPC network"
}

variable "subnet_name" {
  type        = string
  default     = "cs-subnet"
  description = "The name of the subnet"
}

variable "subnet_cidr" {
  type        = string
  default     = "10.0.0.0/24"
  description = "The IP range for the subnet"
}
