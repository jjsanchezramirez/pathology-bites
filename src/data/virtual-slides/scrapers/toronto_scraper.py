import json
import time
import re
from urllib.parse import urljoin
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException

class UofTLMPOrganSystemScraper:
    def __init__(self, headless=False):
        """Initialize the scraper with Chrome WebDriver"""
        self.base_url = "https://dlm.lmp.utoronto.ca"
        self.search_url = f"{self.base_url}/primary_image_browse"
        
        # Configure Chrome options
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        
        print("🚀 Starting Chrome browser...")
        self.driver = webdriver.Chrome(options=chrome_options)
        self.wait = WebDriverWait(self.driver, 30)
        
        # Keep track of processed cases to avoid duplicates
        self.seen_cases = set()
        
        # Organ systems from the HTML structure
        self.organ_systems = [
            {'id': '8', 'name': 'Blood Vessels'},
            {'id': '11', 'name': 'Heart'},
            {'id': '19', 'name': 'White Blood Cells, Lymph Nodes, Spleen, and Thymus'},
            {'id': '79', 'name': 'Red Blood Cells and Bleeding Disorders'},
            {'id': '86', 'name': 'Lung'},
            {'id': '16', 'name': 'Head and Neck'},
            {'id': '14', 'name': 'Gastrointestinal Tract'},
            {'id': '18', 'name': 'Liver and Biliary Tract'},
            {'id': '80', 'name': 'Pancreas'},
            {'id': '17', 'name': 'Kidney'},
            {'id': '81', 'name': 'Lower Urinary Tract and Male Genital System'},
            {'id': '82', 'name': 'Female Genital Tract'},
            {'id': '10', 'name': 'Breast'},
            {'id': '12', 'name': 'Endocrine System'},
            {'id': '24', 'name': 'Skin'},
            {'id': '83', 'name': 'Bones, Joints, and Soft-Tissue Tumours'},
            {'id': '84', 'name': 'Peripheral Nerve and Skeletal Muscle'},
            {'id': '85', 'name': 'Central Nervous System'},
            {'id': '13', 'name': 'Eye'}
        ]
        
    def __del__(self):
        """Clean up the browser when done"""
        if hasattr(self, 'driver'):
            self.driver.quit()
    
    def handle_disclaimer(self):
        """Handle the disclaimer popup if it appears"""
        try:
            # Look for disclaimer popup
            disclaimer_enter = self.wait.until(
                EC.element_to_be_clickable((By.ID, "disclaimer_enter"))
            )
            print("📋 Disclaimer popup detected, accepting...")
            disclaimer_enter.click()
            
            # Wait for disclaimer to disappear
            self.wait.until(
                EC.invisibility_of_element_located((By.ID, "disclaimer"))
            )
            print("✅ Disclaimer accepted")
            time.sleep(2)
            
        except TimeoutException:
            print("ℹ️ No disclaimer popup found, proceeding...")
    
    def search_organ_system(self, organ_system_id, organ_system_name):
        """Search for cases in a specific organ system"""
        try:
            print(f"🔍 Searching {organ_system_name} (ID: {organ_system_id})")
            
            # Navigate to search page
            self.driver.get(self.search_url)
            self.handle_disclaimer()
            
            # Wait for form to load
            self.wait.until(
                EC.presence_of_element_located((By.ID, "views-exposed-form-search-page-1"))
            )
            
            # Select the organ system
            organ_select = Select(self.driver.find_element(By.ID, "edit-field-organ-system-tid"))
            organ_select.select_by_value(organ_system_id)
            print(f"   ✅ Selected organ system: {organ_system_name}")
            
            # Set items per page to maximum (60)
            try:
                items_select = Select(self.driver.find_element(By.ID, "edit-items-per-page"))
                items_select.select_by_value("60")
                print("   📄 Set to 60 items per page")
            except Exception as e:
                print(f"   ⚠️ Could not set items per page: {e}")
            
            # Submit the search
            submit_button = self.driver.find_element(By.ID, "edit-submit-search")
            submit_button.click()
            
            # Wait for results to load
            time.sleep(3)
            
            # Get all cases from all pages
            all_cases = self.scrape_all_pages()
            
            # Add organ system info to each case
            for case in all_cases:
                case['organ_system_searched'] = organ_system_name
                case['organ_system_id_searched'] = organ_system_id
            
            print(f"   📊 Found {len(all_cases)} total cases for {organ_system_name}")
            return all_cases
            
        except Exception as e:
            print(f"   ❌ Error searching {organ_system_name}: {e}")
            return []
    
    def scrape_all_pages(self):
        """Scrape all pages of results for the current search"""
        all_cases = []
        page_num = 1
        
        while True:
            print(f"     📄 Processing page {page_num}...")
            
            # Parse cases from current page
            cases = self.parse_cases_from_page()
            all_cases.extend(cases)
            
            if len(cases) == 0:
                print(f"     ⚠️ No cases found on page {page_num}")
            
            # Check for next page
            next_url = self.get_next_page_url()
            if not next_url:
                print(f"     ✅ Reached last page (page {page_num})")
                break
            
            # Navigate to next page
            print(f"     ➡️ Moving to page {page_num + 1}...")
            self.driver.get(next_url)
            time.sleep(2)  # Be respectful to the server
            page_num += 1
            
            # Safety check to avoid infinite loops
            if page_num > 50:
                print("     ⚠️ Reached maximum page limit (50), stopping...")
                break
        
        return all_cases
    
    def parse_cases_from_page(self):
        """Parse all cases from the current page"""
        cases = []
        
        try:
            # Wait for results table to load
            self.wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div.view-content"))
            )
            
            # Find all case containers in the table
            case_containers = self.driver.find_elements(By.CSS_SELECTOR, "div.ds-2col-fluid.search-page-1-fields")
            
            print(f"       📋 Found {len(case_containers)} cases on current page")
            
            for i, container in enumerate(case_containers):
                try:
                    case_data = self.parse_single_case(container)
                    if case_data and case_data.get('lmp_id') not in self.seen_cases:
                        self.seen_cases.add(case_data['lmp_id'])
                        cases.append(case_data)
                        print(f"         ✅ Case {i+1}: {case_data.get('title', 'Unknown')[:50]}...")
                    elif case_data:
                        print(f"         ⏭️ Case {i+1}: Already seen")
                        
                except Exception as e:
                    print(f"         ❌ Error parsing case {i+1}: {e}")
                    continue
            
        except TimeoutException:
            print("       ⚠️ No results found on page")
        except Exception as e:
            print(f"       ❌ Error parsing page: {e}")
        
        return cases
    
    def parse_single_case(self, container):
        """Parse a single case from a container element"""
        case_data = {
            'lmp_id': '',
            'title': '',
            'case_url': '',
            'organ_system': '',
            'gender': '',
            'age': '',
            'species': '',
            'diagnosis': '',
            'diagnostic_modality': '',
            'diagnosis_codes': [],
            'thumbnail_url': '',
            'full_image_url': ''
        }
        
        try:
            # Get the title and URL
            title_link = container.find_element(By.CSS_SELECTOR, "div.views-field-title a")
            case_data['title'] = title_link.text.strip()
            case_data['case_url'] = urljoin(self.base_url, title_link.get_attribute('href'))
            
            # Extract LMP ID from title (format: [LMP12345])
            title_match = re.search(r'\[LMP(\d+)\]', case_data['title'])
            if title_match:
                case_data['lmp_id'] = f"LMP{title_match.group(1)}"
            else:
                # Use URL as fallback ID
                case_data['lmp_id'] = case_data['case_url'].split('/')[-1]
            
            # Get thumbnail image
            try:
                thumbnail_img = container.find_element(By.CSS_SELECTOR, "div.views-field-field_image_thumbnail img")
                case_data['thumbnail_url'] = thumbnail_img.get_attribute('src')
                
                # Get the full image URL from the link
                thumbnail_link = container.find_element(By.CSS_SELECTOR, "div.views-field-field_image_thumbnail a")
                case_data['full_image_url'] = urljoin(self.base_url, thumbnail_link.get_attribute('href'))
            except NoSuchElementException:
                pass
            
            # Extract organ system
            try:
                organ_element = container.find_element(By.CSS_SELECTOR, "div.views-field-field_organ_system")
                try:
                    organ_link = organ_element.find_element(By.TAG_NAME, "a")
                    case_data['organ_system'] = organ_link.text.strip()
                except NoSuchElementException:
                    text = organ_element.text.strip()
                    case_data['organ_system'] = re.sub(r'^[^:]+:\s*', '', text)
            except NoSuchElementException:
                pass
            
            # Extract gender
            try:
                gender_element = container.find_element(By.CSS_SELECTOR, "div.views-field-field_gender")
                text = gender_element.text.strip()
                case_data['gender'] = re.sub(r'^[^:]+:\s*', '', text)
            except NoSuchElementException:
                pass
            
            # Extract age
            try:
                age_element = container.find_element(By.CSS_SELECTOR, "div.views-field-field_age")
                text = age_element.text.strip()
                case_data['age'] = re.sub(r'^[^:]+:\s*', '', text)
            except NoSuchElementException:
                pass
            
            # Extract species
            try:
                species_element = container.find_element(By.CSS_SELECTOR, "div.views-field-field_species")
                try:
                    species_link = species_element.find_element(By.TAG_NAME, "a")
                    case_data['species'] = species_link.text.strip()
                except NoSuchElementException:
                    text = species_element.text.strip()
                    case_data['species'] = re.sub(r'^[^:]+:\s*', '', text)
            except NoSuchElementException:
                pass
            
            # Extract diagnosis
            try:
                diagnosis_element = container.find_element(By.CSS_SELECTOR, "div.views-field-field_diagnosis")
                text = diagnosis_element.text.strip()
                case_data['diagnosis'] = re.sub(r'^[^:]+:\s*', '', text)
            except NoSuchElementException:
                pass
            
            # Extract diagnostic modality
            try:
                modality_element = container.find_element(By.CSS_SELECTOR, "div.views-field-field_diagnostic_modality")
                try:
                    modality_link = modality_element.find_element(By.TAG_NAME, "a")
                    case_data['diagnostic_modality'] = modality_link.text.strip()
                except NoSuchElementException:
                    text = modality_element.text.strip()
                    case_data['diagnostic_modality'] = re.sub(r'^[^:]+:\s*', '', text)
            except NoSuchElementException:
                pass
            
            # Extract diagnosis codes
            try:
                codes_element = container.find_element(By.CSS_SELECTOR, "div.views-field-field_diagnosis_code_1")
                codes_text = codes_element.text.strip()
                codes_text = re.sub(r'^[^:]+:\s*', '', codes_text)  # Remove label
                
                # Parse different code formats (ICD-10: X | ICD-O: Y)
                codes = []
                if '|' in codes_text:
                    parts = [part.strip() for part in codes_text.split('|')]
                    for part in parts:
                        if ':' in part:
                            code_type, code_value = part.split(':', 1)
                            codes.append({
                                'type': code_type.strip(),
                                'code': code_value.strip()
                            })
                        else:
                            codes.append({'type': 'Unknown', 'code': part})
                elif ':' in codes_text:
                    code_type, code_value = codes_text.split(':', 1)
                    codes.append({
                        'type': code_type.strip(),
                        'code': code_value.strip()
                    })
                elif codes_text:
                    codes.append({'type': 'Unknown', 'code': codes_text})
                
                case_data['diagnosis_codes'] = codes
            except NoSuchElementException:
                pass
            
        except Exception as e:
            print(f"           ⚠️ Error parsing case details: {e}")
            return None
        
        return case_data
    
    def get_next_page_url(self):
        """Check if there's a next page and return its URL"""
        try:
            # Look for the "next" link in pagination
            next_link = self.driver.find_element(By.CSS_SELECTOR, "li.pager-next a")
            return urljoin(self.base_url, next_link.get_attribute('href'))
        except NoSuchElementException:
            return None
    
    def scrape_all_organ_systems(self, limit_systems=None):
        """Scrape cases for all organ systems"""
        print("=== University of Toronto LMP Digital Library - Organ System Scraper ===\n")
        
        organ_systems = self.organ_systems
        if limit_systems:
            organ_systems = organ_systems[:limit_systems]
            print(f"🧪 Testing mode: Processing first {len(organ_systems)} organ systems")
        else:
            print(f"🔬 Full scrape: Processing all {len(organ_systems)} organ systems")
        
        all_cases = []
        
        for i, system in enumerate(organ_systems, 1):
            print(f"\n[{i}/{len(organ_systems)}] Processing: {system['name']}")
            
            try:
                cases = self.search_organ_system(system['id'], system['name'])
                all_cases.extend(cases)
                
                print(f"   ✅ Added {len(cases)} cases from {system['name']}")
                
                # Be respectful to the server
                time.sleep(3)
                
            except Exception as e:
                print(f"   ❌ Error processing {system['name']}: {e}")
                continue
        
        return all_cases
    
    def scrape_specific_organ_systems(self, system_names):
        """Scrape cases for specific organ systems by name"""
        print(f"🎯 Scraping specific organ systems: {system_names}")
        
        # Find matching systems
        selected_systems = []
        for name in system_names:
            for system in self.organ_systems:
                if name.lower() in system['name'].lower():
                    selected_systems.append(system)
                    break
            else:
                print(f"⚠️ Organ system not found: {name}")
        
        if not selected_systems:
            print("❌ No matching organ systems found")
            return []
        
        print(f"📋 Found {len(selected_systems)} matching systems:")
        for system in selected_systems:
            print(f"   - {system['name']}")
        
        all_cases = []
        
        for i, system in enumerate(selected_systems, 1):
            print(f"\n[{i}/{len(selected_systems)}] Processing: {system['name']}")
            
            try:
                cases = self.search_organ_system(system['id'], system['name'])
                all_cases.extend(cases)
                
                print(f"   ✅ Added {len(cases)} cases from {system['name']}")
                time.sleep(3)
                
            except Exception as e:
                print(f"   ❌ Error processing {system['name']}: {e}")
                continue
        
        return all_cases
    
    def save_results(self, data, filename='uoft_lmp_organ_systems.json'):
        """Save results to JSON file with statistics"""
        try:
            # Remove duplicates based on LMP ID
            unique_cases = {}
            for case in data:
                lmp_id = case.get('lmp_id', case.get('case_url', ''))
                if lmp_id not in unique_cases:
                    unique_cases[lmp_id] = case
            
            final_data = list(unique_cases.values())
            
            # Save main data
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(final_data, f, indent=2, ensure_ascii=False)
            
            print(f"\n🎉 SCRAPING COMPLETE!")
            print(f"📁 Saved {len(final_data)} unique cases to {filename}")
            
            # Generate statistics
            stats = self.generate_statistics(final_data)
            
            # Save statistics
            stats_filename = filename.replace('.json', '_statistics.json')
            with open(stats_filename, 'w', encoding='utf-8') as f:
                json.dump(stats, f, indent=2, ensure_ascii=False)
            
            print(f"📊 Statistics saved to {stats_filename}")
            self.print_statistics(stats)
            
            return final_data
            
        except Exception as e:
            print(f"❌ Error saving results: {e}")
            return []
    
    def generate_statistics(self, data):
        """Generate comprehensive statistics"""
        stats = {
            'total_cases': len(data),
            'cases_with_diagnosis': sum(1 for case in data if case.get('diagnosis')),
            'cases_with_images': sum(1 for case in data if case.get('thumbnail_url')),
            'organ_systems': {},
            'species': {},
            'diagnostic_modalities': {},
            'age_groups': {},
            'gender_distribution': {}
        }
        
        # Count by categories
        for case in data:
            # Organ systems
            organ = case.get('organ_system', 'Unknown')
            stats['organ_systems'][organ] = stats['organ_systems'].get(organ, 0) + 1
            
            # Species
            species = case.get('species', 'Unknown')
            stats['species'][species] = stats['species'].get(species, 0) + 1
            
            # Diagnostic modalities
            modality = case.get('diagnostic_modality', 'Unknown')
            stats['diagnostic_modalities'][modality] = stats['diagnostic_modalities'].get(modality, 0) + 1
            
            # Gender
            gender = case.get('gender', 'Unknown')
            stats['gender_distribution'][gender] = stats['gender_distribution'].get(gender, 0) + 1
            
            # Age groups (simplified)
            age = case.get('age', '')
            if 'year' in age.lower():
                if any(x in age for x in ['0 ', '1 ', '2 ', '3 ', '4 ']):
                    age_group = 'Child (0-4 years)'
                elif any(x in age for x in ['5 ', '6 ', '7 ', '8 ', '9 ', '10 ', '11 ', '12 ', '13 ', '14 ', '15 ', '16 ', '17 ']):
                    age_group = 'Adolescent (5-17 years)'
                elif any(x in age for x in ['18 ', '19 ', '20 ', '21 ', '22 ', '23 ', '24 ', '25 ', '26 ', '27 ', '28 ', '29 ', '30 ', '31 ', '32 ', '33 ', '34 ', '35 ', '36 ', '37 ', '38 ', '39 ', '40 ', '41 ', '42 ', '43 ', '44 ', '45 ', '46 ', '47 ', '48 ', '49 ', '50 ', '51 ', '52 ', '53 ', '54 ', '55 ', '56 ', '57 ', '58 ', '59 ', '60 ', '61 ', '62 ', '63 ', '64 ']):
                    age_group = 'Adult (18-64 years)'
                else:
                    age_group = 'Senior (65+ years)'
            elif 'month' in age.lower() or 'day' in age.lower():
                age_group = 'Infant'
            else:
                age_group = 'Unknown'
            
            stats['age_groups'][age_group] = stats['age_groups'].get(age_group, 0) + 1
        
        return stats
    
    def print_statistics(self, stats):
        """Print statistics in a readable format"""
        print(f"\n📊 SCRAPING STATISTICS:")
        print(f"   Total Cases: {stats['total_cases']}")
        print(f"   Cases with Diagnosis: {stats['cases_with_diagnosis']}")
        print(f"   Cases with Images: {stats['cases_with_images']}")
        
        print(f"\n🔬 Top Organ Systems:")
        sorted_organs = sorted(stats['organ_systems'].items(), key=lambda x: x[1], reverse=True)
        for organ, count in sorted_organs[:10]:
            print(f"   - {organ}: {count} cases")
        
        print(f"\n🐾 Species Distribution:")
        for species, count in sorted(stats['species'].items(), key=lambda x: x[1], reverse=True):
            print(f"   - {species}: {count} cases")
        
        print(f"\n👥 Gender Distribution:")
        for gender, count in sorted(stats['gender_distribution'].items(), key=lambda x: x[1], reverse=True):
            print(f"   - {gender}: {count} cases")

def main():
    """Main function"""
    print("🏥 University of Toronto LMP Digital Library Scraper")
    print("Choose scraping mode:")
    print("1. Test mode (first 3 organ systems)")
    print("2. Full scrape (all organ systems)")
    print("3. Specific organ systems")
    print("4. Custom number of organ systems")
    
    try:
        choice = input("\nEnter choice (1-4): ").strip()
        
        # Ask about headless mode
        headless_choice = input("Run in headless mode? (y/n): ").strip().lower()
        headless = headless_choice in ['y', 'yes']
        
        # Create scraper
        scraper = UofTLMPOrganSystemScraper(headless=headless)
        
        if choice == "1":
            print("\n🧪 Test mode: Scraping first 3 organ systems")
            data = scraper.scrape_all_organ_systems(limit_systems=3)
            scraper.save_results(data, 'uoft_lmp_test.json')
            
        elif choice == "2":
            print("\n🔬 Full scrape: All organ systems")
            data = scraper.scrape_all_organ_systems()
            scraper.save_results(data, 'uoft_lmp_full.json')
            
        elif choice == "3":
            print("\nAvailable organ systems:")
            for i, system in enumerate(scraper.organ_systems, 1):
                print(f"   {i}. {system['name']}")
            
            selected = input("\nEnter organ system names (comma-separated): ").strip()
            system_names = [name.strip() for name in selected.split(',')]
            
            data = scraper.scrape_specific_organ_systems(system_names)
            scraper.save_results(data, 'uoft_lmp_specific.json')
            
        elif choice == "4":
            num_systems = int(input("Enter number of organ systems to scrape: "))
            data = scraper.scrape_all_organ_systems(limit_systems=num_systems)
            scraper.save_results(data, f'uoft_lmp_{num_systems}_systems.json')
            
        else:
            print("Invalid choice, using test mode")
            data = scraper.scrape_all_organ_systems(limit_systems=3)
            scraper.save_results(data, 'uoft_lmp_test.json')
        
    except KeyboardInterrupt:
        print("\n\n⏹️ Scraping interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        print("\n👋 Scraping completed!")

if __name__ == "__main__":
    main()