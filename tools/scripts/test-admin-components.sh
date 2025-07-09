#!/bin/bash

# 🧪 Admin Components Testing Script
# This script runs tests systematically according to the testing roadmap

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_phase() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Function to run tests with error handling
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    print_status "Running: $test_name"
    
    if eval "$test_command"; then
        print_success "$test_name passed"
        return 0
    else
        print_error "$test_name failed"
        return 1
    fi
}

# Function to check if development server is running
check_dev_server() {
    if curl -s http://localhost:3000 > /dev/null; then
        print_success "Development server is running"
        return 0
    else
        print_warning "Development server is not running. Start with: npm run dev"
        return 1
    fi
}

# Main testing function
run_admin_tests() {
    local phase="$1"
    local failed_tests=0
    local total_tests=0
    
    case "$phase" in
        "1"|"auth")
            print_phase "PHASE 1: Authentication & Role-Based Access"
            
            # Role-based access tests
            ((total_tests++))
            if ! run_test "useUserRole Hook Tests" "npm test -- src/shared/hooks/__tests__/use-user-role.test.ts --verbose"; then
                ((failed_tests++))
            fi
            
            ((total_tests++))
            if ! run_test "Middleware Tests" "npm test -- src/shared/services/__tests__/middleware.test.ts --verbose"; then
                ((failed_tests++))
            fi
            
            ((total_tests++))
            if ! run_test "RoleGuard Component Tests" "npm test -- src/shared/components/auth --verbose"; then
                ((failed_tests++))
            fi
            ;;
            
        "2"|"layout")
            print_phase "PHASE 2: Layout & Navigation"
            
            ((total_tests++))
            if ! run_test "Sidebar Component Tests" "npm test -- src/shared/components/layout/__tests__/sidebar.test.tsx --verbose"; then
                ((failed_tests++))
            fi
            
            ((total_tests++))
            if ! run_test "Layout Components Tests" "npm test -- src/shared/components/layout --verbose"; then
                ((failed_tests++))
            fi
            ;;
            
        "3"|"dashboard")
            print_phase "PHASE 3: Dashboard Components"
            
            ((total_tests++))
            if ! run_test "Dashboard Service Tests" "npm test -- src/features/dashboard --verbose"; then
                ((failed_tests++))
            fi
            
            ((total_tests++))
            if ! run_test "Stats Cards Tests" "npm test -- src/shared/components/layout/dashboard/__tests__/stats-cards.test.tsx --verbose"; then
                ((failed_tests++))
            fi
            
            ((total_tests++))
            if ! run_test "Dashboard Components Tests" "npm test -- src/shared/components/layout/dashboard --verbose"; then
                ((failed_tests++))
            fi
            ;;
            
        "4"|"users")
            print_phase "PHASE 4: User Management"
            
            ((total_tests++))
            if ! run_test "Users Components Tests" "npm test -- src/features/users --verbose"; then
                ((failed_tests++))
            fi
            
            ((total_tests++))
            if ! run_test "Users API Tests" "npm test -- src/app/api/admin/users --verbose"; then
                ((failed_tests++))
            fi
            ;;
            
        "5"|"questions")
            print_phase "PHASE 5: Question Management"
            
            ((total_tests++))
            if ! run_test "Questions Components Tests" "npm test -- src/features/questions --verbose"; then
                ((failed_tests++))
            fi
            
            ((total_tests++))
            if ! run_test "Questions API Tests" "npm test -- src/app/api/admin/questions --verbose"; then
                ((failed_tests++))
            fi
            ;;
            
        "6"|"review")
            print_phase "PHASE 6: Review System"
            
            ((total_tests++))
            if ! run_test "Question Reviews API Tests" "npm test -- src/app/api/question-reviews --verbose"; then
                ((failed_tests++))
            fi
            
            ((total_tests++))
            if ! run_test "Question Flags API Tests" "npm test -- src/app/api/question-flags --verbose"; then
                ((failed_tests++))
            fi
            ;;
            
        "7"|"e2e")
            print_phase "PHASE 7: End-to-End Tests"
            
            # Check if dev server is running
            if ! check_dev_server; then
                print_error "Development server must be running for E2E tests"
                return 1
            fi
            
            ((total_tests++))
            if ! run_test "Admin E2E Tests" "npm run test:e2e -- --grep 'admin'"; then
                ((failed_tests++))
            fi
            ;;
            
        "all")
            print_phase "RUNNING ALL ADMIN TESTS"
            
            # Run all phases
            for phase_num in 1 2 3 4 5 6; do
                run_admin_tests "$phase_num"
            done
            
            # Run E2E tests if dev server is available
            if check_dev_server; then
                run_admin_tests "7"
            else
                print_warning "Skipping E2E tests - development server not running"
            fi
            ;;
            
        *)
            print_error "Unknown phase: $phase"
            echo "Available phases:"
            echo "  1 or auth      - Authentication & Role-Based Access"
            echo "  2 or layout    - Layout & Navigation"
            echo "  3 or dashboard - Dashboard Components"
            echo "  4 or users     - User Management"
            echo "  5 or questions - Question Management"
            echo "  6 or review    - Review System"
            echo "  7 or e2e       - End-to-End Tests"
            echo "  all            - Run all tests"
            return 1
            ;;
    esac
    
    # Print summary
    if [ "$phase" != "all" ]; then
        echo -e "\n${BLUE}========================================${NC}"
        echo -e "${BLUE} PHASE $phase SUMMARY${NC}"
        echo -e "${BLUE}========================================${NC}"
        echo -e "Total tests: $total_tests"
        echo -e "Failed tests: $failed_tests"
        echo -e "Success rate: $(( (total_tests - failed_tests) * 100 / total_tests ))%"
        
        if [ $failed_tests -eq 0 ]; then
            print_success "All tests passed! ✅"
        else
            print_error "$failed_tests test(s) failed ❌"
        fi
    fi
    
    return $failed_tests
}

# Function to run coverage report
run_coverage() {
    print_phase "GENERATING COVERAGE REPORT"
    
    print_status "Running tests with coverage..."
    npm test -- --coverage \
        src/shared/hooks/use-user-role \
        src/shared/components/layout \
        src/shared/components/auth \
        src/features/dashboard \
        src/features/users \
        src/features/questions \
        --coverageReporters=text-lcov \
        --coverageReporters=html
    
    print_success "Coverage report generated in coverage/ directory"
}

# Function to run specific component test
run_component_test() {
    local component="$1"
    
    case "$component" in
        "sidebar")
            run_test "Sidebar Component" "npm test -- src/shared/components/layout/__tests__/sidebar.test.tsx --verbose"
            ;;
        "stats")
            run_test "Stats Cards Component" "npm test -- src/shared/components/layout/dashboard/__tests__/stats-cards.test.tsx --verbose"
            ;;
        "role-hook")
            run_test "useUserRole Hook" "npm test -- src/shared/hooks/__tests__/use-user-role.test.ts --verbose"
            ;;
        *)
            print_error "Unknown component: $component"
            echo "Available components:"
            echo "  sidebar    - Admin sidebar component"
            echo "  stats      - Dashboard stats cards"
            echo "  role-hook  - useUserRole hook"
            return 1
            ;;
    esac
}

# Main script logic
main() {
    echo -e "${GREEN}🧪 Admin Components Testing Script${NC}"
    echo -e "${GREEN}====================================${NC}\n"
    
    case "${1:-help}" in
        "help"|"-h"|"--help")
            echo "Usage: $0 [command] [options]"
            echo ""
            echo "Commands:"
            echo "  phase <number>     Run specific test phase (1-7)"
            echo "  component <name>   Run specific component test"
            echo "  coverage          Generate coverage report"
            echo "  all               Run all tests"
            echo "  help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 phase 1         # Run authentication tests"
            echo "  $0 phase dashboard # Run dashboard tests"
            echo "  $0 component sidebar # Test sidebar component"
            echo "  $0 coverage        # Generate coverage report"
            echo "  $0 all             # Run all tests"
            ;;
        "phase")
            if [ -z "$2" ]; then
                print_error "Phase number required"
                exit 1
            fi
            run_admin_tests "$2"
            ;;
        "component")
            if [ -z "$2" ]; then
                print_error "Component name required"
                exit 1
            fi
            run_component_test "$2"
            ;;
        "coverage")
            run_coverage
            ;;
        "all")
            run_admin_tests "all"
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Run '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
