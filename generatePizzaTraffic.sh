#!/bin/bash

# Check if host is provided as a command line argument
if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 http://localhost:3000"
  exit 1
fi
host=$1

# Trap SIGINT (Ctrl+C) to execute the cleanup function
cleanup() {
  echo "Terminating background processes..."
  kill $pid1 $pid2 $pid3 $pid4 $pid5 $pid6 $pid7 $pid8 2>/dev/null
  exit 0
}
trap cleanup SIGINT

# Wrap curl command to return HTTP response codes
execute_curl() {
  echo $(eval "curl -s -o /dev/null -w \"%{http_code}\" $1")
}

# Function to login and get a token
login() {
  response=$(curl -s -X PUT $host/api/auth -d "{\"email\":\"$1\", \"password\":\"$2\"}" -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token')
  echo $token
}

# Function to register a new user
register_user() {
  timestamp=$(date +%s%N)
  response=$(curl -s -X POST $host/api/auth -d "{\"name\":\"user_$timestamp\", \"email\":\"user_$timestamp@jwt.com\", \"password\":\"password\"}" -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token')
  echo $token
}

# Simulate a user requesting the menu every 3 seconds
while true; do
  result=$(execute_curl $host/api/order/menu)
  echo "Requesting menu..." $result
  sleep 3
done &
pid1=$!

# Simulate a user with an invalid email and password every 25 seconds
while true; do
  result=$(execute_curl "-X PUT \"$host/api/auth\" -d '{\"email\":\"unknown@jwt.com\", \"password\":\"bad\"}' -H 'Content-Type: application/json'")
  echo "Logging in with invalid credentials..." $result
  sleep 25
done &
pid2=$!

# Simulate a franchisee logging in and performing actions every 90 seconds
while true; do
  token=$(login "f@jwt.com" "franchisee")
  echo "Login franchisee..." $( [ -z "$token" ] && echo "false" || echo "true" )
  sleep 20
  result=$(execute_curl "-X GET $host/api/franchise -H \"Authorization: Bearer $token\"")
  echo "Getting franchises..." $result
  sleep 20
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out franchisee..." $result
  sleep 50
done &
pid3=$!

# Simulate a diner ordering pizzas every 40 seconds
while true; do
  token=$(login "d@jwt.com" "diner")
  echo "Login diner..." $( [ -z "$token" ] && echo "false" || echo "true" )
  result=$(execute_curl "-X POST $host/api/order -H 'Content-Type: application/json' -d '{\"franchiseId\": 1, \"storeId\":1, \"items\":[{ \"menuId\": 1, \"description\": \"Veggie\", \"price\": 0.05 }]}'  -H \"Authorization: Bearer $token\"")
  echo "Bought a pizza..." $result
  sleep 10
  result=$(execute_curl "-X GET $host/api/order -H \"Authorization: Bearer $token\"")
  echo "Getting orders..." $result
  sleep 5
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out diner..." $result
  sleep 25
done &
pid4=$!

# Simulate failed pizza orders every 4 minutes
while true; do
  token=$(login "d@jwt.com" "diner")
  echo "Login hungry diner..." $( [ -z "$token" ] && echo "false" || echo "true" )

  items='{ "menuId": 1, "description": "Veggie", "price": 0.05 }'
  for (( i=0; i < 21; i++ ))
  do items+=', { "menuId": 1, "description": "Veggie", "price": 0.05 }'
  done
  
  result=$(execute_curl "-X POST $host/api/order -H 'Content-Type: application/json' -d '{\"franchiseId\": 1, \"storeId\":1, \"items\":[$items]}'  -H \"Authorization: Bearer $token\"")
  echo "Bought too many pizzas..." $result  
  sleep 5
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out hungry diner..." $result
  sleep 235
done &
pid5=$!

# Simulate regular user registrations every 70 seconds
while true; do
  timestamp=$(date +%s%N)
  result=$(execute_curl "-X POST $host/api/auth -d '{\"name\":\"newuser_$timestamp\", \"email\":\"newuser_$timestamp@jwt.com\", \"password\":\"newpass\"}' -H 'Content-Type: application/json'")
  echo "Registering new user..." $result
  sleep 70
done &
pid6=$!

# Simulate admin adding menu items every 3 minutes
while true; do
  token=$(login "a@jwt.com" "admin")
  echo "Login admin..." $( [ -z "$token" ] && echo "false" || echo "true" )
  sleep 5
  timestamp=$(date +%s%N)
  result=$(execute_curl "-X PUT $host/api/order/menu -H 'Content-Type: application/json' -d '{\"title\":\"Special_$timestamp\", \"description\": \"Limited time offer\", \"image\":\"pizza.png\", \"price\": 0.06}' -H \"Authorization: Bearer $token\"")
  echo "Added menu item..." $result
  sleep 10
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out admin..." $result
  sleep 165
done &
pid7=$!

# Simulate user profile lookups every 60 seconds
while true; do
  token=$(login "d@jwt.com" "diner")
  echo "Login user for profile check..." $( [ -z "$token" ] && echo "false" || echo "true" )
  sleep 5
  result=$(execute_curl "-X GET $host/api/user -H \"Authorization: Bearer $token\"")
  echo "Getting user profile..." $result
  sleep 10
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out after profile check..." $result
  sleep 45
done &
pid8=$!


# Wait for the background processes to complete
wait $pid1 $pid2 $pid3 $pid4 $pid5 $pid6 $pid7 $pid8