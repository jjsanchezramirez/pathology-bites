import json
import time
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from urllib.parse import urljoin, urlparse

class MGHPathologySeleniumScraper:
    def __init__(self, headless=False):
        """Initialize the scraper with Chrome WebDriver"""
        self.base_url = "https://learn.mghpathology.org"
        self.start_url = f"{self.base_url}/index.php/WSI:study"
        
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
        self.wait = WebDriverWait(self.driver, 20)
        
        # Keep track of all URLs to avoid duplicates
        self.seen_urls = set()
        
    def __del__(self):
        """Clean up the browser when done"""
        if hasattr(self, 'driver'):
            self.driver.quit()
    
    def get_study_sections(self):
        """Get all study sections from the main WSI:study page"""
        try:
            print(f"📖 Loading main study page: {self.start_url}")
            self.driver.get(self.start_url)
            
            # Wait for page to load
            self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "h2")))
            
            sections = []
            
            # Find all h2 elements that represent sections
            h2_elements = self.driver.find_elements(By.TAG_NAME, "h2")
            
            for h2 in h2_elements:
                section_name = h2.text.strip()
                if not section_name or section_name == "Contents":
                    continue
                    
                section_data = {
                    'name': section_name,
                    'study_sets': []
                }
                
                # Find the next ul element after this h2
                try:
                    # Use XPath to find the next ul sibling after this h2
                    ul_element = h2.find_element(By.XPATH, "following-sibling::ul[1]")
                    
                    # Find all li elements in this ul
                    li_elements = ul_element.find_elements(By.TAG_NAME, "li")
                    
                    for li in li_elements:
                        try:
                            # Find the link in this li
                            link = li.find_element(By.TAG_NAME, "a")
                            href = link.get_attribute('href')
                            text = li.text.strip()  # Use li.text to get the full text including slide count
                            
                            # Extract slide count from the full li text
                            slide_count_match = re.search(r'\((\d+)\s+slides?\)', text)
                            slide_count = int(slide_count_match.group(1)) if slide_count_match else 0
                            
                            # Get clean title from the link text
                            clean_title = link.text.strip()
                            
                            if href and clean_title:
                                section_data['study_sets'].append({
                                    'title': clean_title,
                                    'url': href,
                                    'slide_count': slide_count
                                })
                                
                        except NoSuchElementException:
                            continue
                    
                except NoSuchElementException:
                    print(f"   ⚠️ No study sets found for section: {section_name}")
                    continue
                
                if section_data['study_sets']:
                    sections.append(section_data)
                    print(f"✅ Found section: {section_name} with {len(section_data['study_sets'])} study sets")
                    for study_set in section_data['study_sets']:
                        print(f"   - {study_set['title']} ({study_set['slide_count']} slides)")
            
            return sections
            
        except Exception as e:
            print(f"❌ Error getting study sections: {e}")
            return []
    
    def get_topic_pages(self, study_set_url):
        """Get topic pages from a study set page (like Dr. Roberts' Placental cases)"""
        try:
            print(f"🔍 Loading study set page: {study_set_url}")
            self.driver.get(study_set_url)
            
            # Wait for page to load
            self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            
            topics = []
            
            # First, check if this page has a data table (direct cases)
            try:
                table = self.driver.find_element(By.CLASS_NAME, "cargoDynamicTable")
                # If we found a table, this page contains cases directly
                print(f"✅ Found direct cases table - treating as single topic")
                return [{
                    'title': 'Direct Cases',
                    'url': study_set_url,
                    'slide_count': 0
                }]
            except NoSuchElementException:
                pass
            
            # Look for numbered list items with topic links (like Dr. Roberts' structure)
            ol_elements = self.driver.find_elements(By.TAG_NAME, "ol")
            
            for ol in ol_elements:
                li_elements = ol.find_elements(By.TAG_NAME, "li")
                
                for li in li_elements:
                    try:
                        # Find the main link in this list item
                        link = li.find_element(By.TAG_NAME, "a")
                        href = link.get_attribute('href')
                        text = link.text.strip()
                        
                        # Extract slide count
                        slide_count_match = re.search(r'\((\d+)\s+slides?\)', li.text)
                        slide_count = int(slide_count_match.group(1)) if slide_count_match else 0
                        
                        if href and text:
                            topics.append({
                                'title': text,
                                'url': href,
                                'slide_count': slide_count
                            })
                            
                    except NoSuchElementException:
                        continue
            
            # If no numbered lists found, look for other link patterns
            if not topics:
                # Look for any links that might be topics
                content_div = self.driver.find_element(By.ID, "mw-content-text")
                links = content_div.find_elements(By.XPATH, ".//a[contains(@href, '/index.php/')]")
                
                for link in links:
                    href = link.get_attribute('href')
                    text = link.text.strip()
                    
                    # Skip navigation and common links
                    if any(skip in href.lower() for skip in ['main_page', 'special:', 'user:', 'talk:']):
                        continue
                    
                    # Look for slide count in surrounding text
                    parent_text = link.find_element(By.XPATH, "..").text
                    slide_count_match = re.search(r'\((\d+)\s+slides?\)', parent_text)
                    slide_count = int(slide_count_match.group(1)) if slide_count_match else 0
                    
                    if text and len(text) > 3:  # Avoid short/empty links
                        topics.append({
                            'title': text,
                            'url': href,
                            'slide_count': slide_count
                        })
            
            print(f"✅ Found {len(topics)} topics")
            for topic in topics:
                print(f"   - {topic['title']} ({topic['slide_count']} slides)")
            return topics
            
        except Exception as e:
            print(f"❌ Error getting topic pages: {e}")
            return []
    
    def scrape_cases_from_topic(self, topic_url, section_name, subsection_name):
        """Scrape individual cases from a topic page"""
        try:
            print(f"📋 Scraping cases from: {topic_url}")
            self.driver.get(topic_url)
            
            # Wait for page to load
            self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            
            # Try to toggle the diagnosis column if it exists
            try:
                diagnosis_toggle = self.driver.find_element(By.LINK_TEXT, "Diagnosis")
                if diagnosis_toggle:
                    print("   🔄 Toggling diagnosis column to make it visible...")
                    self.driver.execute_script("arguments[0].click();", diagnosis_toggle)
                    time.sleep(1)  # Wait for column to appear
            except NoSuchElementException:
                print("   ℹ️ No diagnosis toggle found, proceeding...")
            
            cases = []
            
            # Try to find the main data table (multiple possible class names)
            table = None
            table_selectors = [
                "table.cargoDynamicTable",
                "table.display",
                "table[class*='cargo']",
                "table[class*='dynamic']"
            ]
            
            for selector in table_selectors:
                try:
                    table = self.driver.find_element(By.CSS_SELECTOR, selector)
                    break
                except NoSuchElementException:
                    continue
            
            if not table:
                print("   ⚠️ No data table found on this page")
                return []
            
            # Get the table headers to understand column structure
            headers = []
            try:
                thead = table.find_element(By.TAG_NAME, "thead")
                header_row = thead.find_element(By.TAG_NAME, "tr")
                header_cells = header_row.find_elements(By.TAG_NAME, "th")
                headers = [cell.text.strip().lower() for cell in header_cells]
                print(f"   📋 Table headers: {headers}")
            except NoSuchElementException:
                # No headers found, will guess based on content
                print("   ⚠️ No table headers found, will guess column structure")
            
            # Create column mapping
            col_map = {}
            for i, header in enumerate(headers):
                if 'case' in header:
                    col_map['case'] = i
                elif 'clinical' in header or 'history' in header:
                    col_map['clinical'] = i
                elif 'requester' in header:
                    col_map['requester'] = i
                elif 'diagnosis' in header:
                    col_map['diagnosis'] = i
            
            # Find tbody, or use the table directly if no tbody
            try:
                tbody = table.find_element(By.TAG_NAME, "tbody")
            except NoSuchElementException:
                tbody = table
            
            rows = tbody.find_elements(By.TAG_NAME, "tr")
            
            for i, row in enumerate(rows):
                try:
                    cells = row.find_elements(By.TAG_NAME, "td")
                    if len(cells) < 2:  # Need at least 2 cells for meaningful data
                        continue
                    
                    case_data = {
                        'section': section_name,
                        'subsection': subsection_name,
                        'case_name': '',
                        'case_url': '',
                        'preview_image_url': '',
                        'clinical_history': '',
                        'diagnosis': '',
                        'requester': ''
                    }
                    
                    # Use column mapping if available, otherwise fall back to positional
                    case_col = col_map.get('case', 0)
                    clinical_col = col_map.get('clinical', 1 if len(cells) > 1 else None)
                    requester_col = col_map.get('requester', 2 if len(cells) > 2 else None)
                    diagnosis_col = col_map.get('diagnosis', 3 if len(cells) > 3 else len(cells) - 1)
                    
                    # Extract case information
                    if case_col < len(cells):
                        case_cell = cells[case_col]
                        
                        # Get case link
                        try:
                            case_link = case_cell.find_element(By.TAG_NAME, "a")
                            case_data['case_name'] = case_link.text.strip()
                            case_data['case_url'] = case_link.get_attribute('href')
                        except NoSuchElementException:
                            case_data['case_name'] = case_cell.text.strip()
                        
                        # Get preview image
                        try:
                            preview_img = case_cell.find_element(By.TAG_NAME, "img")
                            case_data['preview_image_url'] = preview_img.get_attribute('src')
                        except NoSuchElementException:
                            pass
                    
                    # Extract other columns
                    if clinical_col is not None and clinical_col < len(cells):
                        case_data['clinical_history'] = cells[clinical_col].text.strip()
                    
                    if requester_col is not None and requester_col < len(cells):
                        case_data['requester'] = cells[requester_col].text.strip()
                    
                    if diagnosis_col < len(cells):
                        case_data['diagnosis'] = cells[diagnosis_col].text.strip()
                    
                    # Only add if we have meaningful data
                    if case_data['case_name'] or case_data['diagnosis'] or case_data['clinical_history']:
                        cases.append(case_data)
                        print(f"      ✅ {case_data['case_name']} - {case_data['diagnosis'][:50]}...")
                        
                except Exception as e:
                    print(f"      ⚠️ Error parsing case row {i}: {e}")
                    continue
            
            print(f"📊 Found {len(cases)} cases")
            return cases
            
        except Exception as e:
            print(f"❌ Error scraping cases from topic: {e}")
            return []
    
    def scrape_all_data(self, target_section=None, max_sections=None):
        """Scrape all data from MGH Learn Pathology"""
        print("=== MGH Learn Pathology Scraper ===\n")
        
        # Get all study sections
        sections = self.get_study_sections()
        if not sections:
            print("❌ No sections found")
            return []
        
        # Filter to target section if specified
        if target_section:
            original_sections = sections.copy()
            sections = [s for s in sections if target_section.lower() in s['name'].lower()]
            if not sections:
                print(f"❌ Target section '{target_section}' not found")
                print("Available sections:")
                for section in original_sections:
                    print(f"   - {section['name']}")
                return []
        
        # Limit sections for testing if specified
        if max_sections:
            sections = sections[:max_sections]
            print(f"🧪 Testing with first {len(sections)} sections")
        
        all_cases = []
        
        for i, section in enumerate(sections, 1):
            print(f"\n[{i}/{len(sections)}] Processing section: {section['name']}")
            
            for j, study_set in enumerate(section['study_sets'], 1):
                print(f"  [{j}/{len(section['study_sets'])}] Processing study set: {study_set['title']}")
                
                try:
                    # Get topics from this study set
                    topics = self.get_topic_pages(study_set['url'])
                    
                    for k, topic in enumerate(topics, 1):
                        print(f"    [{k}/{len(topics)}] Processing topic: {topic['title']}")
                        
                        # Scrape cases from this topic
                        cases = self.scrape_cases_from_topic(
                            topic['url'], 
                            section['name'], 
                            topic['title']
                        )
                        
                        all_cases.extend(cases)
                        
                        # Be respectful to the server
                        time.sleep(1)
                    
                except Exception as e:
                    print(f"    ❌ Error processing study set {study_set['title']}: {e}")
                    continue
                
                # Be respectful to the server
                time.sleep(2)
        
        # Save results
        self.save_results(all_cases)
        
        return all_cases
    
    def save_results(self, data):
        """Save results to JSON file"""
        output_file = 'mgh_pathology_data.json'
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            print(f"\n🎉 SCRAPING COMPLETE!")
            print(f"📁 Saved {len(data)} cases to {output_file}")
            
            # Summary statistics
            sections = list(set(item['section'] for item in data))
            subsections = list(set(f"{item['section']} > {item['subsection']}" for item in data))
            cases_with_images = sum(1 for item in data if item['preview_image_url'])
            cases_with_diagnosis = sum(1 for item in data if item['diagnosis'])
            
            print(f"📊 Summary:")
            print(f"   - Sections: {len(sections)}")
            print(f"   - Subsections: {len(subsections)}")
            print(f"   - Total cases: {len(data)}")
            print(f"   - Cases with preview images: {cases_with_images}")
            print(f"   - Cases with diagnosis: {cases_with_diagnosis}")
            
            if len(data) > 0:
                print(f"\n📋 Sample cases:")
                for case in data[:3]:
                    print(f"   - {case['section']} > {case['subsection']}")
                    print(f"     Case: {case['case_name']}")
                    print(f"     Diagnosis: {case['diagnosis'][:60]}...")
                    if case['preview_image_url']:
                        print(f"     Preview: {case['preview_image_url']}")
                    print()
            
        except Exception as e:
            print(f"❌ Error saving results: {e}")

def main():
    """Main function"""
    print("MGH Learn Pathology Scraper")
    print("=" * 40)
    print("1. Scrape specific section (e.g., 'Obstetric')")
    print("2. Scrape all sections")
    print("3. Test mode (first section only)")
    
    try:
        choice = input("\nEnter choice (1-3): ").strip()
        
        target_section = None
        max_sections = None
        
        if choice == "1":
            target_section = input("Enter section name (partial match, e.g., 'Obstetric'): ").strip()
        elif choice == "2":
            max_sections = None
        elif choice == "3":
            max_sections = 1
        else:
            print("Invalid choice, using test mode")
            max_sections = 1
        
        # Ask about headless mode
        headless_choice = input("\nRun in headless mode? (y/n): ").strip().lower()
        headless = headless_choice in ['y', 'yes']
        
        # Create scraper and run
        scraper = MGHPathologySeleniumScraper(headless=headless)
        
        if target_section:
            scraper.scrape_all_data(target_section=target_section)
        else:
            scraper.scrape_all_data(max_sections=max_sections)
        
    except KeyboardInterrupt:
        print("\n\n⏹️ Scraping interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        print("\n👋 Done!")

if __name__ == "__main__":
    main()