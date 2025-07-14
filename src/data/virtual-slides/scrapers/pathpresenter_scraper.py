import json
import time
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException, ElementClickInterceptedException, StaleElementReferenceException, WebDriverException
from selenium.webdriver.common.action_chains import ActionChains

class PathPresenterCompleteScraper:
    def __init__(self, headless=False):
        """Initialize the comprehensive PathPresenter scraper"""
        self.base_url = "https://pathpresenter.net"
        self.slide_library_url = "https://pathpresenter.net/slide-library"
        
        # Configure Chrome options
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument("--memory-pressure-off")
        chrome_options.add_argument("--max_old_space_size=4096")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        print("🚀 Starting Chrome browser for PathPresenter Complete Scraper...")
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        self.wait = WebDriverWait(self.driver, 30)
        
        # Keep track of URLs to avoid duplicates globally
        self.seen_case_urls = set()
        self.seen_image_urls = set()
        self.all_cases = []
        
    def __del__(self):
        """Clean up the browser when done"""
        if hasattr(self, 'driver'):
            self.driver.quit()
    
    def login(self, username, password):
        """Login to PathPresenter"""
        try:
            print(f"🔐 Attempting to login to {self.base_url}")
            self.driver.get(self.base_url)
            
            # Wait for page to load
            time.sleep(5)
            
            # Find and click login button
            try:
                login_selectors = [
                    "button:contains('Login')",
                    "a:contains('Login')", 
                    "button:contains('Sign In')",
                    "a:contains('Sign In')",
                    ".login-btn",
                    "#login"
                ]
                
                login_element = None
                for selector in login_selectors:
                    try:
                        if ":contains" in selector:
                            text = selector.split("'")[1]
                            xpath_selector = f"//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{text.lower()}')]"
                            login_element = self.driver.find_element(By.XPATH, xpath_selector)
                        else:
                            login_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                        if login_element and login_element.is_displayed():
                            print(f"   ✅ Found login element")
                            break
                    except NoSuchElementException:
                        continue
                
                if login_element:
                    self.driver.execute_script("arguments[0].click();", login_element)
                    time.sleep(3)
                
                # Fill in credentials
                email_field = self.driver.find_element(By.CSS_SELECTOR, "input[type='email']")
                password_field = self.driver.find_element(By.CSS_SELECTOR, "input[type='password']")
                
                email_field.clear()
                email_field.send_keys(username)
                password_field.clear()
                password_field.send_keys(password)
                
                # Submit login
                submit_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
                submit_button.click()
                
                print("   🔄 Submitted login form, waiting for response...")
                time.sleep(8)
                
                # Check if login was successful
                try:
                    self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".main-content")))
                    print("   ✅ Login successful!")
                    return True
                except TimeoutException:
                    print("   ❌ Login may have failed")
                    return False
                    
            except Exception as e:
                print(f"   ❌ Error during login: {e}")
                return False
                
        except Exception as e:
            print(f"❌ Error accessing login page: {e}")
            return False
    
    def navigate_to_slide_library(self):
        """Navigate to slide library and ensure we're ready to scrape"""
        try:
            print("📚 Navigating to Slide Library...")
            
            # Navigate to slide library
            self.driver.get(self.slide_library_url)
            time.sleep(8)
            
            # Activate list mode
            print("   🔄 Activating List Mode...")
            try:
                toggle_selectors = [
                    "button[title*='List']",
                    "button[title*='list']", 
                    "[title*='List Mode']"
                ]
                
                toggle_button = None
                for selector in toggle_selectors:
                    try:
                        elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                        for element in elements:
                            title = element.get_attribute('title') or ''
                            if 'list' in title.lower() and element.is_displayed():
                                toggle_button = element
                                break
                        if toggle_button:
                            break
                    except:
                        continue
                
                if toggle_button:
                    self.driver.execute_script("arguments[0].click();", toggle_button)
                    print("   ✅ Activated List Mode")
                    time.sleep(5)
                else:
                    print("   ⚠️ List Mode toggle not found, checking if already in table view")
                
                # Verify we're in table view
                try:
                    table = self.driver.find_element(By.CSS_SELECTOR, "table tbody tr")
                    if table:
                        print("   ✅ Table view confirmed")
                        return True
                except:
                    print("   ❌ Could not find table view")
                    return False
                    
            except Exception as e:
                print(f"   ❌ Error activating list mode: {e}")
                return False
                
        except Exception as e:
            print(f"❌ Error navigating to slide library: {e}")
            return False

    def get_pathology_categories(self):
        """Get all pathology categories from the dropdown"""
        try:
            print("🔍 Getting pathology categories...")
            
            # Find the category dropdown
            category_dropdown = None
            dropdown_selectors = [
                "select",
                ".category-select", 
                ".filter-select"
            ]
            
            for selector in dropdown_selectors:
                try:
                    dropdowns = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for dropdown in dropdowns:
                        if dropdown.is_displayed():
                            try:
                                select = Select(dropdown)
                                options = select.options
                                option_texts = [opt.text.strip() for opt in options]
                                
                                # Check if this dropdown has pathology categories
                                pathology_indicators = [
                                    'Bone And Soft Tissue', 'Breast', 'Skin', 'Cytology', 
                                    'Gastrointestinal', 'Hematopathology'
                                ]
                                
                                if any(indicator in option_texts for indicator in pathology_indicators):
                                    category_dropdown = dropdown
                                    print(f"   ✅ Found category dropdown with {len(options)} options")
                                    break
                            except Exception:
                                continue
                    
                    if category_dropdown:
                        break
                        
                except NoSuchElementException:
                    continue
            
            if not category_dropdown:
                print("   ❌ Could not find category dropdown")
                return []
            
            # Extract categories from dropdown
            categories = []
            try:
                select = Select(category_dropdown)
                options = select.options
                
                for option in options:
                    value = option.get_attribute('value')
                    text = option.text.strip()
                    
                    # Skip empty or generic options
                    if text and text.lower() not in ['all', 'select', 'choose', ''] and len(text) > 2:
                        categories.append({
                            'name': text,
                            'value': value,
                            'dropdown': category_dropdown
                        })
                
                print(f"📊 Found {len(categories)} pathology categories:")
                for i, cat in enumerate(categories):
                    print(f"   {i+1}. {cat['name']}")
                
                return categories
                
            except Exception as e:
                print(f"   ❌ Error extracting categories: {e}")
                return []
                
        except Exception as e:
            print(f"❌ Error getting pathology categories: {e}")
            return []
    
    def select_category(self, category):
        """Select a specific pathology category"""
        try:
            print(f"\n🔍 Selecting category: {category['name']}")
            
            # Select from dropdown
            select = Select(category['dropdown'])
            select.select_by_value(category['value'])
            print(f"   ✅ Selected {category['name']} from dropdown")
            
            # Wait for category change to take effect
            time.sleep(5)
            
            return True
            
        except Exception as e:
            print(f"   ❌ Error selecting category {category['name']}: {e}")
            return False

    def set_per_page_to_100(self):
        """Set per-page to 100 for manageable chunks"""
        try:
            print("   📋 Setting per-page to 100 for stable pagination...")
            
            all_selects = self.driver.find_elements(By.CSS_SELECTOR, "select")
            
            for i, dropdown in enumerate(all_selects):
                try:
                    if dropdown.is_displayed():
                        select = Select(dropdown)
                        options = select.options
                        option_texts = [opt.text.strip() for opt in options]
                        
                        # Check if this looks like a per-page dropdown
                        has_numeric_options = any(text.isdigit() for text in option_texts)
                        has_categories = any(cat in ' '.join(option_texts) for cat in ['Skin', 'Breast', 'Bone'])
                        
                        if has_numeric_options and not has_categories and '100' in option_texts:
                            current_selection = select.first_selected_option.text
                            print(f"      Current selection: {current_selection}")
                            
                            if current_selection != '100':
                                select.select_by_visible_text('100')
                                print(f"      Selected: 100")
                                time.sleep(8)  # Wait for page to reload
                                
                                try:
                                    new_selection = Select(dropdown).first_selected_option.text
                                    print(f"      New selection: {new_selection}")
                                    if new_selection == '100':
                                        print("   ✅ Successfully set to 100 per page")
                                        return True
                                except:
                                    pass
                            else:
                                print("   ✅ Already set to 100 per page")
                                return True
                            break
                            
                except Exception as e:
                    continue
            
            print("   ⚠️ Could not find per-page dropdown, continuing with default")
            return True
            
        except Exception as e:
            print(f"   ❌ Error setting per-page: {e}")
            return True

    def find_next_button(self):
        """Find the Next button using multiple strategies"""
        try:
            print("   🔍 Looking for Next button...")
            
            # Strategy 1: Look for the exact aria-label from the HTML
            try:
                next_button = self.driver.find_element(By.CSS_SELECTOR, 'button[aria-label="Go to next page"]')
                if next_button.is_displayed() and next_button.is_enabled():
                    print("   ✅ Found Next button by aria-label")
                    return next_button
            except:
                pass
            
            # Strategy 2: Look for the '›' text in page-link buttons
            try:
                next_button = self.driver.find_element(By.XPATH, "//button[@class='page-link' and text()='›']")
                if next_button.is_displayed() and next_button.is_enabled():
                    print("   ✅ Found Next button by text '›'")
                    return next_button
            except:
                pass
            
            # Strategy 3: Look in pagination container for enabled buttons with › or »
            try:
                pagination = self.driver.find_element(By.CSS_SELECTOR, ".pagination")
                buttons = pagination.find_elements(By.TAG_NAME, "button")
                for button in buttons:
                    text = button.text.strip()
                    if text in ['›', '»', 'Next'] and button.is_displayed() and button.is_enabled():
                        print(f"   ✅ Found Next button in pagination: '{text}'")
                        return button
            except:
                pass
            
            print("   ❌ No Next button found")
            return None
            
        except Exception as e:
            print(f"   ❌ Error finding Next button: {e}")
            return None

    def get_current_page_cases(self, page_num, category_name):
        """Extract cases from the current page (Digital Slides Only)"""
        try:
            print(f"   📋 Extracting cases from page {page_num}...")
            
            # Wait for content to load
            time.sleep(5)
            
            # Get all table rows
            table_rows = self.driver.find_elements(By.CSS_SELECTOR, "table tbody tr")
            
            if not table_rows:
                print(f"   ⚠️ No table rows found on page {page_num}")
                return []
            
            print(f"      Found {len(table_rows)} table rows")
            
            page_cases = []
            duplicates_found = 0
            
            for i, row in enumerate(table_rows):
                try:
                    case_data = self.extract_single_case(row, i, page_num, category_name)
                    if case_data:
                        # Use the actual case_id for deduplication (much more reliable)
                        case_id = case_data.get('case_id', '')
                        
                        # Check for duplicates using case ID
                        if case_id and case_id not in self.seen_case_urls:
                            self.seen_case_urls.add(case_id)
                            page_cases.append(case_data)
                        elif case_id in self.seen_case_urls:
                            duplicates_found += 1
                        else:
                            # Fallback for cases without case_id
                            fallback_id = f"{case_data['name']}_{case_data['diagnosis']}_{case_data['stain']}_{category_name}"
                            if fallback_id not in self.seen_case_urls:
                                self.seen_case_urls.add(fallback_id)
                                page_cases.append(case_data)
                            else:
                                duplicates_found += 1
                        
                except Exception as e:
                    print(f"      ⚠️ Error extracting case {i+1}: {e}")
                    continue
            
            if duplicates_found > 0:
                print(f"      Skipped {duplicates_found} duplicate cases")
            
            print(f"   ✅ Extracted {len(page_cases)} unique digital slides from page {page_num}")
            return page_cases
            
        except Exception as e:
            print(f"   ❌ Error extracting cases from page {page_num}: {e}")
            return []

    def extract_single_case(self, case_element, index, page_num, category_name):
        """Extract information from a single pathology case (Digital Slides Only)"""
        case_data = {
            'case_id': '',
            'name': '',
            'diagnosis': '',
            'section': '',
            'stain': '',
            'slide_type': '',
            'conversion_status': '',
            'user_name': '',
            'case_url': '',
            'image_urls': [],
            'page_number': page_num,
            'category': category_name,
            'metadata': {}
        }
        
        try:
            # Extract case ID from data-pk attribute
            case_id = case_element.get_attribute('data-pk')
            if case_id:
                case_data['case_id'] = case_id
                # Reconstruct case URL using the correct PathPresenter pattern
                case_data['case_url'] = f"https://pathpresenter.net/display/{case_id}?type=slide-library-public"
            
            # Extract from table format
            cells = case_element.find_elements(By.TAG_NAME, "td")
            if len(cells) >= 6:
                try:
                    case_data['name'] = cells[1].text.strip() if len(cells) > 1 else ''
                    case_data['section'] = cells[2].text.strip() if len(cells) > 2 else ''
                    case_data['diagnosis'] = cells[3].text.strip() if len(cells) > 3 else ''
                    case_data['stain'] = cells[4].text.strip() if len(cells) > 4 else ''
                    case_data['slide_type'] = cells[5].text.strip() if len(cells) > 5 else ''
                    case_data['conversion_status'] = cells[6].text.strip() if len(cells) > 6 else ''
                    case_data['user_name'] = cells[7].text.strip() if len(cells) > 7 else ''
                    
                    # FILTER: Only process Digital Slides
                    if case_data['slide_type'] != 'Digital Slide':
                        return None
                    
                    # Debug: Print first few cases from each page
                    if index < 3:
                        print(f"        Digital Slide {index+1}: '{case_data['name']}' - '{case_data['diagnosis']}' (ID: {case_id})")
                    
                    # Look for thumbnail image
                    try:
                        img = cells[0].find_element(By.TAG_NAME, "img")
                        if img:
                            src = img.get_attribute('src')
                            if src and src not in self.seen_image_urls and 'blob.core.windows.net' in src:
                                self.seen_image_urls.add(src)
                                case_data['image_urls'].append(src)
                    except:
                        pass
                    
                    # Try to find actual view URL by looking for view button click data
                    try:
                        view_buttons = case_element.find_elements(By.CSS_SELECTOR, "button[aria-label='view']")
                        if view_buttons:
                            # Store that a view button exists
                            case_data['metadata']['has_view_button'] = True
                    except:
                        pass
                        
                except Exception as e:
                    print(f"        ⚠️ Error extracting table data: {e}")
            else:
                print(f"        ⚠️ Row {index+1} has {len(cells)} cells, expected 6+")
            
            # Only return Digital Slides with meaningful data
            if (case_data['slide_type'] == 'Digital Slide' and 
                (case_data['name'] or case_data['diagnosis']) and 
                case_data['case_id']):
                return case_data
            else:
                if index < 5 and case_data['slide_type'] != 'Digital Slide':
                    print(f"        ⚠️ Skipping non-digital slide: {case_data['slide_type']}")
            
            return None
            
        except Exception as e:
            print(f"        ⚠️ Error extracting single case: {e}")
            return None

    def scrape_category_with_pagination(self, category, max_pages=None):
        """Scrape all cases from a category using pagination"""
        print(f"\n🔍 Scraping category: {category['name']} with pagination...")
        
        # Select the category
        if not self.select_category(category):
            print(f"❌ Failed to select category {category['name']}")
            return []
        
        # Set per-page to 100 for stable pagination
        self.set_per_page_to_100()
        
        # Set reasonable max pages if not specified
        if max_pages is None:
            max_pages = 50  # Should handle most categories
        
        category_cases = []
        current_page = 1
        consecutive_empty_pages = 0
        max_empty_pages = 3
        
        while current_page <= max_pages and consecutive_empty_pages < max_empty_pages:
            print(f"\n   [Page {current_page}] Processing {category['name']}...")
            
            try:
                # Extract cases from current page
                page_cases = self.get_current_page_cases(current_page, category['name'])
                
                if page_cases:
                    category_cases.extend(page_cases)
                    consecutive_empty_pages = 0
                    
                    # Show sample cases
                    for i, case in enumerate(page_cases[:2]):
                        name = case['name'][:40] + '...' if len(case['name']) > 40 else case['name']
                        diagnosis = case['diagnosis'][:25] + '...' if len(case['diagnosis']) > 25 else case['diagnosis']
                        print(f"      Sample {i+1}: {name} - {diagnosis}")
                    
                    if len(page_cases) > 2:
                        print(f"      ... and {len(page_cases) - 2} more cases")
                    
                    print(f"   ✅ Page {current_page}: {len(page_cases)} cases (Category total: {len(category_cases)})")
                    
                    # If we got fewer than expected cases, we might be near the end
                    if len(page_cases) < 50:
                        print(f"   ⚠️ Got {len(page_cases)} cases (less than expected) - might be approaching end")
                else:
                    print(f"   ⚠️ No cases found on page {current_page}")
                    consecutive_empty_pages += 1
                
                # Try to navigate to next page
                next_button = self.find_next_button()
                
                if next_button:
                    try:
                        print(f"   📄 Clicking Next button to go to page {current_page + 1}")
                        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", next_button)
                        time.sleep(2)
                        self.driver.execute_script("arguments[0].click();", next_button)
                        time.sleep(6)  # Wait for page load
                        
                        current_page += 1
                        print(f"   ✅ Successfully navigated to page {current_page}")
                        
                    except Exception as e:
                        print(f"   ❌ Error clicking Next button: {e}")
                        print(f"   ⚠️ Stopping pagination for {category['name']}")
                        break
                else:
                    print(f"   ⚠️ No Next button found - reached end of {category['name']}")
                    break
                
                # Be respectful to the server
                time.sleep(2)
                
            except Exception as e:
                print(f"   ❌ Error processing page {current_page}: {e}")
                consecutive_empty_pages += 1
                current_page += 1
                continue
        
        print(f"\n✅ Finished {category['name']}: {len(category_cases)} digital slides")
        return category_cases

    def scrape_all_pathology_categories(self, username, password, specific_categories=None, max_categories=None):
        """Main scraping function for all pathology categories"""
        print("=== PathPresenter Complete Scraper ===\n")
        print("🎯 Target: ALL pathology categories with digital slides only")
        print("📋 Features: Proper pagination, URL reconstruction, deduplication")
        print()
        
        # Login
        if not self.login(username, password):
            print("❌ Login failed. Please check your credentials.")
            return []
        
        # Navigate to slide library
        if not self.navigate_to_slide_library():
            print("❌ Failed to navigate to slide library")
            return []
        
        # Get pathology categories
        categories = self.get_pathology_categories()
        if not categories:
            print("❌ No pathology categories found")
            return []
        
        # Filter categories if specific ones are requested
        if specific_categories:
            categories = [cat for cat in categories if cat['name'] in specific_categories]
            print(f"🎯 Filtering to specific categories: {specific_categories}")
        
        # Limit categories for testing
        if max_categories:
            categories = categories[:max_categories]
            print(f"🧪 Testing with first {len(categories)} categories")
        
        total_cases = 0
        total_images = 0
        
        print(f"\n🚀 Starting to scrape {len(categories)} categories...")
        
        for i, category in enumerate(categories, 1):
            print(f"\n{'='*60}")
            print(f"[{i}/{len(categories)}] Processing: {category['name']}")
            print(f"{'='*60}")
            
            try:
                # Scrape this category with pagination
                category_cases = self.scrape_category_with_pagination(category)
                
                # Add to global collection
                self.all_cases.extend(category_cases)
                
                category_images = sum(len(case['image_urls']) for case in category_cases)
                total_cases += len(category_cases)
                total_images += category_images
                
                print(f"\n📊 {category['name']} Summary:")
                print(f"   - Digital slides: {len(category_cases)}")
                print(f"   - Images: {category_images}")
                print(f"   - Running total: {total_cases} cases, {total_images} images")
                
                # Be respectful between categories
                time.sleep(3)
                
            except Exception as e:
                print(f"   ❌ Error processing {category['name']}: {e}")
                continue
        
        # Save final results
        self.save_results()
        
        return self.all_cases
    
    def save_results(self):
        """Save comprehensive results to JSON file"""
        output_file = 'pathpresenter_complete_digital_slides.json'
        
        try:
            # Add final metadata to each case
            for case in self.all_cases:
                case['num_images'] = len(case['image_urls'])
                case['has_case_url'] = bool(case.get('case_url'))
                case['has_image'] = len(case['image_urls']) > 0
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(self.all_cases, f, indent=2, ensure_ascii=False)
            
            print(f"\n{'='*60}")
            print(f"🎉 COMPLETE SCRAPING FINISHED!")
            print(f"{'='*60}")
            print(f"📁 Saved {len(self.all_cases)} digital slides to {output_file}")
            
            # Comprehensive statistics
            categories_processed = len(set(case['category'] for case in self.all_cases))
            cases_with_diagnosis = sum(1 for case in self.all_cases if case['diagnosis'])
            cases_with_images = sum(1 for case in self.all_cases if case['image_urls'])
            cases_with_urls = sum(1 for case in self.all_cases if case.get('case_url'))
            total_images = sum(len(case['image_urls']) for case in self.all_cases)
            
            print(f"📊 FINAL COMPREHENSIVE SUMMARY:")
            print(f"   - Categories processed: {categories_processed}")
            print(f"   - Total digital slides: {len(self.all_cases)}")
            print(f"   - Cases with diagnosis: {cases_with_diagnosis}")
            print(f"   - Cases with images: {cases_with_images}")
            print(f"   - Cases with URLs: {cases_with_urls}")
            print(f"   - Total images: {total_images}")
            print(f"   - Unique image URLs: {len(self.seen_image_urls)}")
            print(f"   - Unique case IDs: {len(self.seen_case_urls)}")
            
            # Category breakdown
            print(f"\n📋 Category Breakdown:")
            category_counts = {}
            for case in self.all_cases:
                cat = case['category']
                category_counts[cat] = category_counts.get(cat, 0) + 1
            
            for category, count in sorted(category_counts.items()):
                print(f"   - {category}: {count} digital slides")
            
            # Show sample cases
            if len(self.all_cases) > 0:
                print(f"\n📋 Sample digital slides:")
                for case in self.all_cases[:10]:
                    name = case['name'][:50] + '...' if len(case['name']) > 50 else case['name']
                    diagnosis = case['diagnosis'][:30] + '...' if len(case['diagnosis']) > 30 else case['diagnosis']
                    case_id = case.get('case_id', 'N/A')
                    print(f"   - {case['category']}: {name} (ID: {case_id})")
                    if diagnosis:
                        print(f"     🔬 Diagnosis: {diagnosis}")
                    if case.get('case_url'):
                        print(f"     🔗 URL: {case['case_url']}")
            
            # Save detailed stats
            stats_file = 'pathpresenter_complete_stats.json'
            stats = {
                'scraping_type': 'Complete PathPresenter Digital Slides',
                'categories_processed': categories_processed,
                'total_cases': len(self.all_cases),
                'cases_with_diagnosis': cases_with_diagnosis,
                'cases_with_images': cases_with_images,
                'cases_with_urls': cases_with_urls,
                'total_images': total_images,
                'unique_image_urls': len(self.seen_image_urls),
                'unique_case_ids': len(self.seen_case_urls),
                'category_breakdown': category_counts,
                'scraping_timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            
            with open(stats_file, 'w', encoding='utf-8') as f:
                json.dump(stats, f, indent=2, ensure_ascii=False)
            
            print(f"📈 Detailed stats saved to {stats_file}")
            
        except Exception as e:
            print(f"❌ Error saving results: {e}")

def main():
    """Main function"""
    print("PathPresenter Complete Scraper v4.0")
    print("===================================")
    print("🎯 Scrapes ALL pathology categories from PathPresenter")
    print("📋 Features: Digital slides only, proper pagination, URL reconstruction")
    print("🔗 Outputs working URLs for each case")
    print()
    
    # Get credentials
    username = input("Enter your PathPresenter username/email: ").strip()
    password = input("Enter your PathPresenter password: ").strip()
    
    if not username or not password:
        print("❌ Username and password are required")
        return
    
    print("\nChoose scraping mode:")
    print("1. Test mode (first 3 categories)")
    print("2. Complete scrape (ALL categories)")
    print("3. Specific categories (e.g., just Skin, Breast)")
    print("4. Custom number of categories")
    
    try:
        choice = input("\nEnter choice (1-4): ").strip()
        
        specific_categories = None
        max_categories = None
        
        if choice == "1":
            max_categories = 3
            print("🧪 Test mode: Will scrape first 3 categories")
        elif choice == "2":
            max_categories = None
            print("🚀 COMPLETE mode: Will scrape ALL categories")
            confirm = input("This will scrape ALL categories. Continue? (y/n): ").strip().lower()
            if confirm not in ['y', 'yes']:
                print("Cancelled.")
                return
        elif choice == "3":
            categories_input = input("Enter categories separated by commas (e.g., Skin, Breast, Bone And Soft Tissue): ").strip()
            specific_categories = [cat.strip() for cat in categories_input.split(',')]
            print(f"🎯 Will scrape specific categories: {specific_categories}")
        elif choice == "4":
            max_categories = int(input("Enter number of categories to scrape: "))
            print(f"🔢 Will scrape first {max_categories} categories")
        else:
            print("Invalid choice, using test mode")
            max_categories = 3
        
        # Ask about headless mode
        headless_choice = input("\nRun in headless mode? (y/n): ").strip().lower()
        headless = headless_choice in ['y', 'yes']
        
        print(f"\n🚀 Starting PathPresenter Complete Scraper...")
        print(f"   - Target: Digital slides from all pathology categories")
        print(f"   - Username: {username}")
        print(f"   - Mode: {'Headless' if headless else 'Visible browser'}")
        if specific_categories:
            print(f"   - Categories: {specific_categories}")
        elif max_categories:
            print(f"   - Max categories: {max_categories}")
        else:
            print(f"   - Max categories: All available")
        print()
        
        # Create scraper and run
        scraper = PathPresenterCompleteScraper(headless=headless)
        results = scraper.scrape_all_pathology_categories(
            username, password, 
            specific_categories=specific_categories,
            max_categories=max_categories
        )
        
        print(f"\n🎯 MISSION ACCOMPLISHED!")
        print(f"📊 Successfully scraped {len(results)} digital slides from PathPresenter!")
        
    except KeyboardInterrupt:
        print("\n\n⏹️ Scraping interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("\n👋 Done!")

if __name__ == "__main__":
    main()