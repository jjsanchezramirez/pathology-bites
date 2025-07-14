import json
import time
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException

class VirtualPathologySeleniumScraper:
    def __init__(self, headless=False):
        """Initialize the scraper with Chrome WebDriver"""
        self.base_url = "http://www.virtualpathology.leeds.ac.uk"
        
        # Configure Chrome options
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")
        
        print("🚀 Starting Chrome browser...")
        self.driver = webdriver.Chrome(options=chrome_options)
        self.wait = WebDriverWait(self.driver, 20)
        
        # Keep track of all URLs to avoid duplicates
        self.seen_slide_urls = set()
        self.seen_preview_urls = set()
        
    def __del__(self):
        """Clean up the browser when done"""
        if hasattr(self, 'driver'):
            self.driver.quit()
    
    def get_organ_systems(self):
        """Get all available organ systems from the dropdown"""
        url = f"{self.base_url}/slides/library/advanced.php"
        
        try:
            print(f"📖 Loading advanced search page: {url}")
            self.driver.get(url)
            
            # Wait for the system dropdown to load
            system_dropdown = self.wait.until(
                EC.presence_of_element_located((By.NAME, "system"))
            )
            
            # Get all options from the dropdown
            select = Select(system_dropdown)
            options = select.options
            
            systems = []
            for option in options:
                value = option.get_attribute('value')
                text = option.text.strip()
                
                # Skip placeholder, "Any System", and disabled options
                if (value and 
                    value not in ['none_selected', 'syx'] and 
                    not option.get_attribute('disabled')):
                    systems.append({
                        'id': value,
                        'name': text
                    })
            
            print(f"✅ Found {len(systems)} organ systems")
            for system in systems[:5]:  # Show first 5
                print(f"   - {system['name']} ({system['id']})")
            if len(systems) > 5:
                print(f"   ... and {len(systems) - 5} more")
            
            return systems
            
        except Exception as e:
            print(f"❌ Error getting organ systems: {e}")
            return []
    
    def search_system(self, system_id, system_name):
        """Search for cases in a specific organ system"""
        url = f"{self.base_url}/slides/library/advanced.php"
        
        try:
            print(f"\n🔍 Searching {system_name} ({system_id})")
            
            # Navigate to the search page
            self.driver.get(url)
            
            # Wait for form to load
            self.wait.until(EC.presence_of_element_located((By.NAME, "system")))
            
            # Select the organ system
            system_dropdown = Select(self.driver.find_element(By.NAME, "system"))
            system_dropdown.select_by_value(system_id)
            print(f"   Selected system: {system_name}")
            
            # Set other dropdowns to "Any" to get all cases
            try:
                stain_dropdown = Select(self.driver.find_element(By.NAME, "stain_type"))
                stain_dropdown.select_by_value("sx")  # Any stain
                
                specimen_dropdown = Select(self.driver.find_element(By.NAME, "specimen_type"))
                specimen_dropdown.select_by_value("sx")  # Any specimen type
                
                age_dropdown = Select(self.driver.find_element(By.NAME, "age"))
                age_dropdown.select_by_value("1")  # Any age
                
                sex_dropdown = Select(self.driver.find_element(By.NAME, "sex"))
                sex_dropdown.select_by_value("A")  # Any sex
                
                print("   Set filters to 'Any' for maximum results")
            except Exception as e:
                print(f"   Warning: Could not set some filters: {e}")
            
            # Submit the form
            submit_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            submit_button.click()
            print("   Submitted search form")
            
            # Wait for results to load (look for success message or case containers)
            try:
                # Try to find success message indicating results loaded
                success_element = self.wait.until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "p.success"))
                )
                success_text = success_element.text
                print(f"   ✅ {success_text}")
                
                # Parse the cases
                cases = self.parse_cases()
                print(f"   📊 Found {len(cases)} cases")
                return cases
                
            except TimeoutException:
                print("   ⚠️ No success message found, checking for cases anyway...")
                cases = self.parse_cases()
                if len(cases) > 0:
                    print(f"   📊 Found {len(cases)} cases (no success message)")
                    return cases
                else:
                    print("   ❌ No cases found")
                    return []
                    
        except Exception as e:
            print(f"   ❌ Error searching {system_name}: {e}")
            return []
    
    def parse_cases(self):
        """Parse cases from the current page"""
        cases = []
        
        try:
            # Find all case containers
            case_containers = self.driver.find_elements(By.CSS_SELECTOR, "div.gradBoxCaseContainer")
            
            for i, container in enumerate(case_containers):
                try:
                    case_data = self.parse_single_case(container, i)
                    if case_data:
                        cases.append(case_data)
                        if case_data['diagnosis']:
                            print(f"      Case {i+1}: {case_data['diagnosis'][:50]}...")
                        else:
                            print(f"      Case {i+1}: {case_data['patient_info']}")
                            
                except Exception as e:
                    print(f"      ⚠️ Error parsing case {i+1}: {e}")
                    continue
            
        except Exception as e:
            print(f"   ❌ Error finding case containers: {e}")
        
        return cases
    
    def parse_single_case(self, container, case_index):
        """Parse a single case container"""
        case_data = {
            'patient_info': '',
            'clinical_details': '',
            'diagnosis': '',
            'slide_urls': [],
            'preview_image_urls': [],
            'unique_slide_count': 0,
            'unique_preview_count': 0
        }
        
        try:
            # Get patient info and clinical details
            button_half = container.find_element(By.CSS_SELECTOR, "div.buttonHalfContainer")
            p_tags = button_half.find_elements(By.TAG_NAME, "p")
            
            if len(p_tags) >= 2:
                case_data['patient_info'] = p_tags[0].text.strip()
                case_data['clinical_details'] = p_tags[1].text.strip()
            
            # Try to get diagnosis by clicking the "View full details" button
            try:
                details_button = button_half.find_element(By.CSS_SELECTOR, f"button[id='details_button_{case_index}']")
                self.driver.execute_script("arguments[0].click();", details_button)
                
                # Wait a moment for the diagnosis to appear
                time.sleep(0.5)
                
                # Now try to find the diagnosis
                hidden_span = container.find_element(By.CSS_SELECTOR, f"span[id='hidden_diagnosis_{case_index}']")
                strong_tag = hidden_span.find_element(By.TAG_NAME, "strong")
                diagnosis = strong_tag.text.strip()
                
                # Clean up the diagnosis text
                diagnosis = re.sub(r'\s*PubMed\s*$', '', diagnosis)
                case_data['diagnosis'] = diagnosis
                
            except NoSuchElementException:
                # Try alternative methods to find diagnosis
                pass
            
            # Get slide URLs (avoid duplicates)
            slide_links = container.find_elements(By.CSS_SELECTOR, "a[href*='slides/library/view.php?path=']")
            new_slide_urls = []
            for link in slide_links:
                href = link.get_attribute('href')
                if href and href not in self.seen_slide_urls:
                    self.seen_slide_urls.add(href)
                    new_slide_urls.append(href)
            case_data['slide_urls'] = new_slide_urls
            case_data['unique_slide_count'] = len(new_slide_urls)
            
            # Get preview image URLs (avoid duplicates)
            preview_images = container.find_elements(By.CSS_SELECTOR, "img[src*='images.virtualpathology.leeds.ac.uk']")
            new_preview_urls = []
            for img in preview_images:
                src = img.get_attribute('src')
                if src and src not in self.seen_preview_urls:
                    self.seen_preview_urls.add(src)
                    new_preview_urls.append(src)
            case_data['preview_image_urls'] = new_preview_urls
            case_data['unique_preview_count'] = len(new_preview_urls)
            
            # Also look for any other images that might be preview images
            # (in case the structure varies)
            all_images = container.find_elements(By.TAG_NAME, "img")
            for img in all_images:
                src = img.get_attribute('src')
                if (src and 
                    'virtualpathology.leeds.ac.uk' in src and 
                    src not in self.seen_preview_urls and
                    src not in new_preview_urls):
                    self.seen_preview_urls.add(src)
                    new_preview_urls.append(src)
            
            # Update counts after checking all images
            case_data['preview_image_urls'] = new_preview_urls
            case_data['unique_preview_count'] = len(new_preview_urls)
            
        except Exception as e:
            print(f"        ⚠️ Error parsing case details: {e}")
        
        return case_data
    
    def scrape_all_systems(self, max_systems=None):
        """Scrape all organ systems"""
        print("=== Enhanced Virtual Pathology Selenium Scraper ===\n")
        
        # Get all organ systems
        systems = self.get_organ_systems()
        if not systems:
            print("❌ No organ systems found")
            return
        
        # Limit systems for testing if specified
        if max_systems:
            systems = systems[:max_systems]
            print(f"🧪 Testing with first {len(systems)} systems")
        
        all_data = []
        total_unique_slides = 0
        total_unique_previews = 0
        
        for i, system in enumerate(systems, 1):
            print(f"\n[{i}/{len(systems)}] Processing: {system['name']}")
            
            try:
                cases = self.search_system(system['id'], system['name'])
                
                system_slides = 0
                system_previews = 0
                
                for case in cases:
                    all_data.append({
                        'system': system['name'],
                        'system_id': system['id'],
                        'patient_info': case['patient_info'],
                        'clinical_details': case['clinical_details'],
                        'diagnosis': case['diagnosis'],
                        'slide_urls': case['slide_urls'],
                        'preview_image_urls': case['preview_image_urls'],
                        'num_slides': len(case['slide_urls']),
                        'num_preview_images': len(case['preview_image_urls']),
                        'unique_slide_count': case['unique_slide_count'],
                        'unique_preview_count': case['unique_preview_count']
                    })
                    
                    system_slides += case['unique_slide_count']
                    system_previews += case['unique_preview_count']
                
                total_unique_slides += system_slides
                total_unique_previews += system_previews
                
                print(f"   ✅ Added {len(cases)} cases from {system['name']}")
                print(f"      📎 {system_slides} unique slide URLs, 🖼️ {system_previews} unique preview images")
                
                # Be respectful to the server
                time.sleep(2)
                
            except Exception as e:
                print(f"   ❌ Error processing {system['name']}: {e}")
                continue
        
        # Save results
        self.save_results(all_data, total_unique_slides, total_unique_previews)
        
        return all_data
    
    def save_results(self, data, total_unique_slides, total_unique_previews):
        """Save results to JSON file"""
        output_file = 'virtual_pathology_data_enhanced.json'
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            print(f"\n🎉 SCRAPING COMPLETE!")
            print(f"📁 Saved {len(data)} cases to {output_file}")
            
            # Summary statistics
            systems_with_data = len(set(item['system'] for item in data))
            total_slides = sum(item['num_slides'] for item in data)
            total_preview_images = sum(item['num_preview_images'] for item in data)
            cases_with_diagnosis = sum(1 for item in data if item['diagnosis'])
            
            print(f"📊 Summary:")
            print(f"   - Systems processed: {systems_with_data}")
            print(f"   - Total cases: {len(data)}")
            print(f"   - Cases with diagnosis: {cases_with_diagnosis}")
            print(f"   - Total slide URLs: {total_slides} (unique: {total_unique_slides})")
            print(f"   - Total preview images: {total_preview_images} (unique: {total_unique_previews})")
            print(f"   - Duplicate slide URLs avoided: {total_slides - total_unique_slides}")
            print(f"   - Duplicate preview images avoided: {total_preview_images - total_unique_previews}")
            
            if len(data) > 0:
                print(f"\n📋 Sample cases:")
                for case in data[:3]:
                    diagnosis = case['diagnosis'][:50] + '...' if len(case['diagnosis']) > 50 else case['diagnosis']
                    print(f"   - {case['system']}: {diagnosis}")
                    if case['preview_image_urls']:
                        print(f"     🖼️ Sample preview: {case['preview_image_urls'][0]}")
            
            # Save deduplication stats
            stats_file = 'scraping_stats.json'
            stats = {
                'total_cases': len(data),
                'systems_processed': systems_with_data,
                'total_slide_urls': total_slides,
                'unique_slide_urls': total_unique_slides,
                'duplicate_slides_avoided': total_slides - total_unique_slides,
                'total_preview_images': total_preview_images,
                'unique_preview_images': total_unique_previews,
                'duplicate_previews_avoided': total_preview_images - total_unique_previews,
                'cases_with_diagnosis': cases_with_diagnosis
            }
            
            with open(stats_file, 'w', encoding='utf-8') as f:
                json.dump(stats, f, indent=2, ensure_ascii=False)
            
            print(f"📈 Detailed stats saved to {stats_file}")
            
        except Exception as e:
            print(f"❌ Error saving results: {e}")

def main():
    """Main function"""
    print("Choose scraping mode:")
    print("1. Test mode (first 3 systems)")
    print("2. Full scrape (all systems)")
    print("3. Custom number of systems")
    
    try:
        choice = input("\nEnter choice (1-3): ").strip()
        
        if choice == "1":
            max_systems = 3
        elif choice == "2":
            max_systems = None
        elif choice == "3":
            max_systems = int(input("Enter number of systems to scrape: "))
        else:
            print("Invalid choice, using test mode")
            max_systems = 3
        
        # Ask about headless mode
        headless_choice = input("\nRun in headless mode? (y/n): ").strip().lower()
        headless = headless_choice in ['y', 'yes']
        
        # Create scraper and run
        scraper = VirtualPathologySeleniumScraper(headless=headless)
        scraper.scrape_all_systems(max_systems=max_systems)
        
    except KeyboardInterrupt:
        print("\n\n⏹️ Scraping interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        print("\n👋 Done!")

if __name__ == "__main__":
    main()