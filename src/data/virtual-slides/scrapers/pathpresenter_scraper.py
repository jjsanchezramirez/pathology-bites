import json
import time
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException, ElementClickInterceptedException
from selenium.webdriver.common.action_chains import ActionChains

class PathPresenterSlideLibraryScraper:
    def __init__(self, headless=False):
        """Initialize the scraper with Chrome WebDriver"""
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
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        print("🚀 Starting Chrome browser for PathPresenter Slide Library...")
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        self.wait = WebDriverWait(self.driver, 30)
        
        # Keep track of URLs to avoid duplicates
        self.seen_case_urls = set()
        self.seen_image_urls = set()
        
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
            
            # Look for and click login button
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
                
                # Check if login was successful by looking for dashboard elements
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
        """Navigate specifically to the slide library page"""
        try:
            print("📚 Navigating to Slide Library...")
            
            # First try clicking the Slide Library link in navigation
            try:
                slide_library_link = self.driver.find_element(By.XPATH, "//a[contains(text(), 'Slide Library')]")
                if slide_library_link and slide_library_link.is_displayed():
                    print("   🔗 Found Slide Library navigation link")
                    self.driver.execute_script("arguments[0].click();", slide_library_link)
                    time.sleep(5)
                    
                    # Verify we're on the slide library page
                    if "slide-library" in self.driver.current_url:
                        print("   ✅ Successfully navigated to Slide Library")
                        return True
            except NoSuchElementException:
                pass
            
            # Direct navigation to slide library URL
            print(f"   🌐 Direct navigation to: {self.slide_library_url}")
            self.driver.get(self.slide_library_url)
            time.sleep(8)
            
            # Wait for slide library content to load
            try:
                # Look for slide library specific elements
                slide_library_indicators = [
                    ".slide-library",
                    "h1:contains('Slide Library')",
                    "h2:contains('Slide Library')",
                    ".category-dropdown",
                    ".filter-dropdown"
                ]
                
                for indicator in slide_library_indicators:
                    try:
                        if ":contains" in indicator:
                            text = indicator.split("'")[1]
                            xpath = f"//h1[contains(text(), '{text}')] | //h2[contains(text(), '{text}')]"
                            element = self.driver.find_element(By.XPATH, xpath)
                        else:
                            element = self.driver.find_element(By.CSS_SELECTOR, indicator)
                        
                        if element:
                            print(f"   ✅ Found slide library content: {indicator}")
                            return True
                    except NoSuchElementException:
                        continue
                
                # Check current URL
                if "slide-library" in self.driver.current_url:
                    print("   ✅ On slide library page (confirmed by URL)")
                    return True
                
                print("   ⚠️ May not be on slide library page")
                return False
                
            except Exception as e:
                print(f"   ⚠️ Error verifying slide library page: {e}")
                return False
                
        except Exception as e:
            print(f"❌ Error navigating to slide library: {e}")
            return False
    
    def get_pathology_categories(self):
        """Get pathology categories from the slide library dropdown"""
        try:
            print("🔍 Looking for pathology categories dropdown...")
            
            # Wait a bit more for the page to fully load
            time.sleep(5)
            
            # Look for the category dropdown - based on the screenshots
            dropdown_selectors = [
                "select",  # Generic select element
                ".category-select", 
                ".filter-select",
                "select[name*='category']",
                "select[name*='filter']",
                "select[class*='category']",
                "select[class*='filter']"
            ]
            
            dropdown_element = None
            for selector in dropdown_selectors:
                try:
                    dropdowns = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for dropdown in dropdowns:
                        if dropdown.is_displayed():
                            # Check if this dropdown has pathology-related options
                            try:
                                select = Select(dropdown)
                                options = select.options
                                option_texts = [opt.text.strip() for opt in options]
                                
                                # Look for known pathology categories
                                pathology_indicators = [
                                    'Bone And Soft Tissue', 'Breast', 'Cytology', 
                                    'Gastrointestinal', 'Hematopathology'
                                ]
                                
                                if any(indicator in ' '.join(option_texts) for indicator in pathology_indicators):
                                    dropdown_element = dropdown
                                    print(f"   ✅ Found pathology category dropdown with {len(options)} options")
                                    break
                            except Exception:
                                continue
                    
                    if dropdown_element:
                        break
                        
                except NoSuchElementException:
                    continue
            
            if not dropdown_element:
                print("   ⚠️ No category dropdown found, looking for alternative category elements...")
                
                # Look for clickable category elements
                category_selectors = [
                    "button[class*='category']",
                    "div[class*='category']", 
                    ".filter-button",
                    ".category-item"
                ]
                
                for selector in category_selectors:
                    try:
                        elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                        if elements:
                            print(f"   ✅ Found {len(elements)} potential category elements")
                            # Return a basic structure for these elements
                            categories = []
                            for i, elem in enumerate(elements):
                                text = elem.text.strip()
                                if text and len(text) > 2:
                                    categories.append({
                                        'name': text,
                                        'element': elem,
                                        'type': 'clickable'
                                    })
                            return categories
                    except:
                        continue
                
                return []
            
            # Extract categories from dropdown
            categories = []
            try:
                select = Select(dropdown_element)
                options = select.options
                
                for option in options:
                    value = option.get_attribute('value')
                    text = option.text.strip()
                    
                    # Skip empty or generic options
                    if text and text.lower() not in ['all', 'select', 'choose', ''] and len(text) > 2:
                        categories.append({
                            'name': text,
                            'value': value,
                            'dropdown': dropdown_element,
                            'type': 'dropdown'
                        })
                
                print(f"📊 Found {len(categories)} pathology categories:")
                for i, cat in enumerate(categories):
                    print(f"   {i+1}. {cat['name']}")
                
                return categories
                
            except Exception as e:
                print(f"   ❌ Error extracting categories from dropdown: {e}")
                return []
                
        except Exception as e:
            print(f"❌ Error getting pathology categories: {e}")
            return []
    
    def select_category(self, category):
        """Select a specific pathology category"""
        try:
            print(f"\n🔍 Selecting category: {category['name']}")
            
            if category['type'] == 'dropdown':
                # Select from dropdown
                select = Select(category['dropdown'])
                current_selection = select.first_selected_option.text
                print(f"   📋 Current category: {current_selection}")
                
                # Select the new category
                select.select_by_value(category['value'])
                print(f"   ✅ Selected category from dropdown")
                
                # Wait for category change to take effect
                time.sleep(5)
                
                # Verify the selection worked
                try:
                    new_selection = Select(category['dropdown']).first_selected_option.text
                    print(f"   📋 New category: {new_selection}")
                    if new_selection == category['name']:
                        print("   ✅ Category selection verified")
                    else:
                        print(f"   ⚠️ Category selection may not have worked. Expected: {category['name']}, Got: {new_selection}")
                except:
                    print("   ⚠️ Could not verify category selection")
                
                # Wait additional time for content to load
                time.sleep(3)
                
            elif category['type'] == 'clickable':
                # Click the category element
                element = category['element']
                self.driver.execute_script("arguments[0].scrollIntoView(true);", element)
                time.sleep(1)
                self.driver.execute_script("arguments[0].click();", element)
                print("   ✅ Clicked category element")
                time.sleep(5)
            
            # Additional verification: check page content for category-specific elements
            try:
                # Wait for any loading indicators to disappear
                time.sleep(3)
                
                # Check if we can find any content that suggests the category loaded
                page_text = self.driver.find_element(By.TAG_NAME, "body").text.lower()
                if category['name'].lower() in page_text:
                    print(f"   ✅ Found '{category['name']}' in page content")
                else:
                    print(f"   ⚠️ Category '{category['name']}' not found in page content")
                    
            except Exception as e:
                print(f"   ⚠️ Could not verify page content: {e}")
            
            return True
            
        except Exception as e:
            print(f"   ❌ Error selecting category {category['name']}: {e}")
            return False
    
    def activate_list_mode(self):
        """Find and click the List Mode toggle button"""
        try:
            print("   🔄 Looking for List Mode toggle button...")
            
            # Look for the toggle button - various possible selectors
            toggle_selectors = [
                "button[title*='List']",
                "button[title*='list']", 
                "[title*='List Mode']",
                "[title*='list mode']",
                "button[aria-label*='List']",
                "button[aria-label*='list']",
                ".toggle-button",
                ".view-toggle",
                ".list-toggle",
                "button[class*='toggle']",
                "button[class*='list']",
                "i[class*='list']",  # Icon that might be clickable
                "[data-toggle*='list']"
            ]
            
            toggle_button = None
            for selector in toggle_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for element in elements:
                        # Check if this looks like a list mode toggle
                        title = element.get_attribute('title') or ''
                        aria_label = element.get_attribute('aria-label') or ''
                        class_name = element.get_attribute('class') or ''
                        
                        if any(term in text.lower() for text in [title, aria_label, class_name] 
                               for term in ['list', 'table', 'grid']):
                            if element.is_displayed():
                                toggle_button = element
                                print(f"   ✅ Found List Mode toggle: {selector}")
                                break
                    
                    if toggle_button:
                        break
                        
                except NoSuchElementException:
                    continue
            
            if toggle_button:
                # Click the toggle button
                try:
                    self.driver.execute_script("arguments[0].scrollIntoView(true);", toggle_button)
                    time.sleep(1)
                    self.driver.execute_script("arguments[0].click();", toggle_button)
                    print("   ✅ Clicked List Mode toggle")
                    
                    # Wait for table to load
                    time.sleep(3)
                    
                    # Verify table is now visible
                    try:
                        table = self.driver.find_element(By.CSS_SELECTOR, "table")
                        if table.is_displayed():
                            print("   ✅ Table view activated successfully")
                            return True
                    except NoSuchElementException:
                        print("   ⚠️ Table not found after toggle")
                        return False
                        
                except Exception as e:
                    print(f"   ⚠️ Error clicking toggle: {e}")
                    return False
            else:
                print("   ⚠️ List Mode toggle button not found")
                # Check if we're already in table view
                try:
                    table = self.driver.find_element(By.CSS_SELECTOR, "table tbody tr")
                    if table:
                        print("   ✅ Already in table view")
                        return True
                except:
                    pass
                return False
                
        except Exception as e:
            print(f"   ❌ Error activating list mode: {e}")
            return False

    def set_show_all_items(self):
        """Set the 'Per Page' dropdown to show all items"""
        try:
            print("   📋 Looking for 'Per Page' dropdown to show all items...")
            
            # Wait a bit for the page to stabilize after category selection
            time.sleep(3)
            
            # Look for "Per Page" dropdown - need to be more specific to avoid category dropdown
            per_page_selectors = [
                "select[class*='per-page']",
                "select[class*='page-size']", 
                ".per-page select",
                ".page-size select",
                ".pagination select",
                "select[name*='per']",
                "select[name*='page']",
                "select[name*='size']"
            ]
            
            # Also try to find ALL select elements and filter them properly
            all_selects = self.driver.find_elements(By.CSS_SELECTOR, "select")
            
            per_page_dropdown = None
            
            # First try specific selectors
            for selector in per_page_selectors:
                try:
                    dropdowns = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for dropdown in dropdowns:
                        if dropdown.is_displayed():
                            try:
                                select = Select(dropdown)
                                options = select.options
                                option_texts = [opt.text.strip() for opt in options]
                                
                                print(f"      🔍 Found dropdown with options: {option_texts}")
                                
                                # Check if this looks like a per-page dropdown (has numbers)
                                has_numbers = any(text.isdigit() for text in option_texts)
                                has_all = any(text.lower() == 'all' for text in option_texts)
                                has_categories = any(text in ['Bone And Soft Tissue', 'Breast', 'Cytology'] for text in option_texts)
                                
                                if has_numbers and not has_categories:
                                    per_page_dropdown = dropdown
                                    print(f"   ✅ Found Per Page dropdown (has numbers, no categories)")
                                    break
                                    
                            except Exception as e:
                                print(f"      ⚠️ Error checking dropdown: {e}")
                                continue
                    
                    if per_page_dropdown:
                        break
                        
                except NoSuchElementException:
                    continue
            
            # If not found, check all select elements
            if not per_page_dropdown:
                print("   🔍 Checking all select elements for per-page dropdown...")
                for dropdown in all_selects:
                    if dropdown.is_displayed():
                        try:
                            select = Select(dropdown)
                            options = select.options
                            option_texts = [opt.text.strip() for opt in options]
                            
                            # Debug: Show all dropdowns found
                            if len(option_texts) > 0:
                                print(f"      🔍 Dropdown options: {option_texts[:10]}...")  # Show first 10
                            
                            # Look for numeric pagination options (10, 20, 30, etc.)
                            numeric_options = [text for text in option_texts if text.isdigit()]
                            has_pagination_numbers = len(numeric_options) >= 3  # At least 3 numbers
                            has_all = any(text.lower() == 'all' for text in option_texts)
                            
                            # Avoid category dropdowns
                            has_categories = any(text in ['Bone And Soft Tissue', 'Breast', 'Cytology', 'Endocrine'] 
                                               for text in option_texts)
                            
                            if has_pagination_numbers and not has_categories:
                                per_page_dropdown = dropdown
                                print(f"   ✅ Found Per Page dropdown with numeric options: {numeric_options}")
                                break
                                
                        except Exception as e:
                            continue
            
            if per_page_dropdown:
                try:
                    select = Select(per_page_dropdown)
                    options = select.options
                    current_selection = select.first_selected_option.text
                    print(f"      📋 Current per-page selection: {current_selection}")
                    
                    # Try to select "All" or highest number
                    all_option = None
                    max_number_option = None
                    max_number = 0
                    
                    for option in options:
                        text = option.text.strip()
                        value = option.get_attribute('value')
                        
                        if text.lower() == 'all':
                            all_option = option
                            print(f"      ✅ Found 'All' option: {text}")
                            break
                        elif text.isdigit():
                            number = int(text)
                            if number > max_number:
                                max_number = number
                                max_number_option = option
                    
                    # Select the best option
                    if all_option:
                        select.select_by_value(all_option.get_attribute('value'))
                        print(f"   ✅ Selected 'All' items for pagination")
                    elif max_number_option and max_number >= 100:
                        select.select_by_value(max_number_option.get_attribute('value'))
                        print(f"   ✅ Selected maximum '{max_number}' items per page")
                    else:
                        print(f"   ⚠️ No suitable 'All' option found, keeping current: {current_selection}")
                        return False
                    
                    # Wait longer for page to reload with all items
                    print("   ⏳ Waiting for page to reload with all items...")
                    time.sleep(10)  # Increased wait time
                    
                    # Verify the change took effect
                    try:
                        new_selection = Select(per_page_dropdown).first_selected_option.text
                        print(f"      📋 New per-page selection: {new_selection}")
                        if new_selection != current_selection:
                            print("   ✅ Per page setting changed successfully")
                            return True
                        else:
                            print("   ⚠️ Per page setting may not have changed")
                            return False
                    except:
                        print("   ⚠️ Could not verify per page change")
                        return True  # Assume it worked
                    
                except Exception as e:
                    print(f"   ⚠️ Error setting per page dropdown: {e}")
                    return False
            else:
                print("   ⚠️ Per Page dropdown not found")
                return False
                
        except Exception as e:
            print(f"   ❌ Error setting show all items: {e}")
            return False

    def handle_pagination(self):
        """Handle pagination to get all cases from additional pages"""
        additional_cases = []
        
        try:
            print("   📄 Checking for pagination...")
            
            # Look for pagination controls
            pagination_selectors = [
                ".pagination a",
                ".page-numbers a", 
                "a[href*='page']",
                "button[class*='page']",
                ".paginate a"
            ]
            
            page_links = []
            for selector in pagination_selectors:
                try:
                    links = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if links:
                        page_links = links
                        break
                except:
                    continue
            
            if not page_links:
                print("   ⚠️ No pagination controls found")
                return additional_cases
            
            # Get current page number and find next pages
            current_page = 1
            max_pages = 5  # Limit to avoid infinite loops
            
            for page_num in range(2, max_pages + 1):
                try:
                    # Look for next page link
                    next_page_found = False
                    for link in page_links:
                        link_text = link.text.strip()
                        if link_text == str(page_num) or link_text.lower() == 'next':
                            print(f"      📄 Going to page {page_num}")
                            self.driver.execute_script("arguments[0].click();", link)
                            time.sleep(5)
                            next_page_found = True
                            break
                    
                    if not next_page_found:
                        break
                    
                    # Extract cases from this page
                    table_rows = self.driver.find_elements(By.CSS_SELECTOR, "table tbody tr")
                    if table_rows:
                        for i, row in enumerate(table_rows[:20]):  # Limit per page
                            try:
                                case_data = self.extract_single_case(row, i + len(additional_cases))
                                if case_data:
                                    additional_cases.append(case_data)
                            except:
                                continue
                        
                        print(f"      ✅ Got {len(table_rows)} more cases from page {page_num}")
                    else:
                        break
                        
                except Exception as e:
                    print(f"      ⚠️ Error on page {page_num}: {e}")
                    break
            
            print(f"   📊 Total additional cases from pagination: {len(additional_cases)}")
            return additional_cases
            
        except Exception as e:
            print(f"   ❌ Error handling pagination: {e}")
            return additional_cases

    def extract_pathology_cases(self):
        """Extract pathology cases from the table view"""
        try:
            print("   📋 Extracting pathology cases...")
            
            # First, try to activate list mode for table view
            if not self.activate_list_mode():
                print("   ⚠️ Could not activate list mode, trying to extract from current view")
            
            # Try to set "Show All" items to avoid pagination
            self.set_show_all_items()
            
            cases = []
            
            # Wait longer for content and images to load
            print("   ⏳ Waiting for all content and images to load...")
            time.sleep(8)  # Increased wait time for images
            
            # Primary method: Extract from table format (List Mode)
            try:
                # Check how many rows are actually available
                all_table_rows = self.driver.find_elements(By.CSS_SELECTOR, "table tbody tr")
                print(f"   📊 Total table rows found: {len(all_table_rows)}")
                
                # Look for any pagination info or total count indicators
                try:
                    pagination_info_selectors = [
                        ".pagination-info",
                        ".results-info", 
                        ".total-results",
                        "[class*='showing']",
                        "[class*='total']"
                    ]
                    
                    for selector in pagination_info_selectors:
                        try:
                            info_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                            if info_element and info_element.text.strip():
                                print(f"   📋 Page info: {info_element.text.strip()}")
                                break
                        except:
                            continue
                except:
                    pass
                
                table_rows = all_table_rows
                if table_rows and len(table_rows) > 0:
                    print(f"   ✅ Found {len(table_rows)} cases in table format")
                    
                    # Extract information from each table row
                    max_cases = min(1000, len(table_rows))  # Increased limit significantly
                    for i, row in enumerate(table_rows[:max_cases]):
                        try:
                            case_data = self.extract_single_case(row, i)
                            if case_data:
                                cases.append(case_data)
                                name = case_data.get('name', 'Unknown')
                                diagnosis = case_data.get('diagnosis', '')
                                if diagnosis:
                                    print(f"      Case {i+1}: {name} - {diagnosis}")
                                else:
                                    print(f"      Case {i+1}: {name}")
                                
                        except Exception as e:
                            print(f"      ⚠️ Error extracting case {i+1}: {e}")
                            continue
                    
                    # If we still have exactly 20 cases, the "All" selection didn't work
                    if len(cases) == 20:
                        print("   ⚠️ Still got exactly 20 cases - 'All' selection may not have worked")
                        print("   💡 Continuing with available cases to avoid pagination errors")
                        # Note: Disabled pagination fallback to avoid stale element errors
                        # additional_cases = self.handle_pagination()
                        # cases.extend(additional_cases)
                    else:
                        print(f"   ✅ Got {len(cases)} cases - 'All' selection appears to have worked")
                    
                    return cases
            except Exception as e:
                print(f"   ⚠️ Error extracting from table: {e}")
            
            # Fallback: Look for grid/card format
            print("   🔄 Trying grid/card format extraction...")
            case_selectors = [
                ".slide-item",
                ".case-item", 
                ".pathology-case",
                ".slide-container",
                ".grid-item",
                ".thumbnail",
                "div[class*='slide']",
                "div[class*='case']"
            ]
            
            case_elements = []
            for selector in case_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements and len(elements) > 1:
                        # Filter for elements that look like actual cases
                        filtered_elements = []
                        for elem in elements:
                            has_image = len(elem.find_elements(By.TAG_NAME, "img")) > 0
                            has_text = len(elem.text.strip()) > 5
                            
                            if has_image or has_text:
                                filtered_elements.append(elem)
                        
                        if len(filtered_elements) > 0:
                            case_elements = filtered_elements
                            print(f"   ✅ Found {len(case_elements)} cases using selector: {selector}")
                            break
                except:
                    continue
            
            if not case_elements:
                print("   ⚠️ No case elements found in any format")
                return []
            
            # Extract information from grid format
            max_cases = min(50, len(case_elements))
            for i, case_elem in enumerate(case_elements[:max_cases]):
                try:
                    case_data = self.extract_single_case(case_elem, i)
                    if case_data:
                        cases.append(case_data)
                        title = case_data.get('name', case_data.get('title', 'Unknown'))
                        print(f"      Case {i+1}: {title}")
                        
                except Exception as e:
                    print(f"      ⚠️ Error extracting case {i+1}: {e}")
                    continue
            
            return cases
            
        except Exception as e:
            print(f"   ❌ Error extracting pathology cases: {e}")
            return []

    def handle_pagination(self):
        """Handle pagination to get all cases from additional pages"""
        additional_cases = []
        
        try:
            print("   📄 Checking for pagination...")
            
            # Look for pagination controls
            pagination_selectors = [
                ".pagination a",
                ".page-numbers a", 
                "a[href*='page']",
                "button[class*='page']",
                ".paginate a"
            ]
            
            page_links = []
            for selector in pagination_selectors:
                try:
                    links = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if links:
                        page_links = links
                        break
                except:
                    continue
            
            if not page_links:
                print("   ⚠️ No pagination controls found")
                return additional_cases
            
            # Get current page number and find next pages
            current_page = 1
            max_pages = 5  # Limit to avoid infinite loops
            
            for page_num in range(2, max_pages + 1):
                try:
                    # Look for next page link
                    next_page_found = False
                    for link in page_links:
                        link_text = link.text.strip()
                        if link_text == str(page_num) or link_text.lower() == 'next':
                            print(f"      📄 Going to page {page_num}")
                            self.driver.execute_script("arguments[0].click();", link)
                            time.sleep(5)
                            next_page_found = True
                            break
                    
                    if not next_page_found:
                        break
                    
                    # Extract cases from this page
                    table_rows = self.driver.find_elements(By.CSS_SELECTOR, "table tbody tr")
                    if table_rows:
                        for i, row in enumerate(table_rows[:20]):  # Limit per page
                            try:
                                case_data = self.extract_single_case(row, i + len(additional_cases))
                                if case_data:
                                    additional_cases.append(case_data)
                            except:
                                continue
                        
                        print(f"      ✅ Got {len(table_rows)} more cases from page {page_num}")
                    else:
                        break
                        
                except Exception as e:
                    print(f"      ⚠️ Error on page {page_num}: {e}")
                    break
            
            print(f"   📊 Total additional cases from pagination: {len(additional_cases)}")
            return additional_cases
            
        except Exception as e:
            print(f"   ❌ Error handling pagination: {e}")
            return additional_cases
    
    def extract_single_case(self, case_element, index):
        """Extract information from a single pathology case"""
        case_data = {
            'name': '',
            'diagnosis': '',
            'section': '',
            'stain': '',
            'slide_type': '',
            'conversion_status': '',
            'user_name': '',
            'case_url': '',
            'image_urls': [],
            'metadata': {}
        }
        
        try:
            # Try to extract from table format first (based on screenshot 3)
            cells = case_element.find_elements(By.TAG_NAME, "td")
            if len(cells) >= 6:  # Table format
                try:
                    case_data['name'] = cells[1].text.strip() if len(cells) > 1 else ''
                    case_data['section'] = cells[2].text.strip() if len(cells) > 2 else ''
                    case_data['diagnosis'] = cells[3].text.strip() if len(cells) > 3 else ''
                    case_data['stain'] = cells[4].text.strip() if len(cells) > 4 else ''
                    case_data['slide_type'] = cells[5].text.strip() if len(cells) > 5 else ''
                    case_data['conversion_status'] = cells[6].text.strip() if len(cells) > 6 else ''
                    case_data['user_name'] = cells[7].text.strip() if len(cells) > 7 else ''
                    
                    # Look for thumbnail image in first cell
                    try:
                        img = cells[0].find_element(By.TAG_NAME, "img")
                        if img:
                            src = img.get_attribute('src')
                            if src and src not in self.seen_image_urls:
                                self.seen_image_urls.add(src)
                                case_data['image_urls'].append(src)
                    except:
                        pass
                    
                    # Look for case URL in action buttons
                    try:
                        links = case_element.find_elements(By.TAG_NAME, "a")
                        for link in links:
                            href = link.get_attribute('href')
                            if href and 'case' in href.lower():
                                case_data['case_url'] = href
                                break
                    except:
                        pass
                        
                except Exception as e:
                    print(f"        ⚠️ Error extracting table data: {e}")
            
            else:
                # Try card/grid format (based on screenshots 1 & 2)
                try:
                    # Look for title/name
                    title_selectors = [
                        "h3", "h4", "h5", 
                        ".title", ".name", ".case-title",
                        ".slide-title", ".diagnosis"
                    ]
                    
                    for selector in title_selectors:
                        try:
                            title_elem = case_element.find_element(By.CSS_SELECTOR, selector)
                            if title_elem and title_elem.text.strip():
                                case_data['name'] = title_elem.text.strip()
                                break
                        except:
                            continue
                    
                    # If no title found, use the element's text
                    if not case_data['name']:
                        elem_text = case_element.text.strip()
                        if elem_text and len(elem_text) < 100:  # Reasonable title length
                            first_line = elem_text.split('\n')[0].strip()
                            case_data['name'] = first_line
                    
                    # Look for images with better wait handling
                    try:
                        images = case_element.find_elements(By.TAG_NAME, "img")
                        for img in images:
                            src = img.get_attribute('src')
                            if src and src not in self.seen_image_urls:
                                # Skip lazy loading placeholders
                                if 'lazy-load' not in src and 'data:image' not in src:
                                    # Filter out small icons
                                    try:
                                        width = int(img.get_attribute('width') or 0)
                                        height = int(img.get_attribute('height') or 0)
                                        if width > 50 and height > 50:
                                            self.seen_image_urls.add(src)
                                            case_data['image_urls'].append(src)
                                    except:
                                        # If size unknown, include if it's a blob URL (actual slide image)
                                        if 'blob.core.windows.net' in src:
                                            self.seen_image_urls.add(src)
                                            case_data['image_urls'].append(src)
                    except:
                        pass
                    
                    # Look for case URL
                    try:
                        if case_element.tag_name == 'a':
                            case_data['case_url'] = case_element.get_attribute('href')
                        else:
                            link = case_element.find_element(By.CSS_SELECTOR, "a")
                            case_data['case_url'] = link.get_attribute('href')
                    except:
                        pass
                        
                except Exception as e:
                    print(f"        ⚠️ Error extracting card data: {e}")
            
            # Only return if we have meaningful data
            if case_data['name'] or case_data['diagnosis'] or case_data['image_urls']:
                return case_data
            
            return None
            
        except Exception as e:
            print(f"        ⚠️ Error extracting single case: {e}")
            return None
    
    def scrape_pathology_categories(self, username, password, max_categories=None):
        """Main scraping function for pathology categories"""
        print("=== PathPresenter Slide Library Scraper ===\n")
        
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
        
        # Limit categories for testing
        if max_categories:
            categories = categories[:max_categories]
            print(f"🧪 Testing with first {len(categories)} categories")
        
        all_data = []
        total_cases = 0
        total_images = 0
        
        for i, category in enumerate(categories, 1):
            print(f"\n[{i}/{len(categories)}] Processing: {category['name']}")
            
            try:
                # Select the category
                if self.select_category(category):
                    # Extract cases for this category
                    cases = self.extract_pathology_cases()
                    
                    category_cases = 0
                    category_images = 0
                    
                    for case in cases:
                        all_data.append({
                            'category': category['name'],
                            'name': case['name'],
                            'diagnosis': case['diagnosis'],
                            'section': case['section'],
                            'stain': case['stain'],
                            'slide_type': case['slide_type'],
                            'conversion_status': case['conversion_status'],
                            'user_name': case['user_name'],
                            'case_url': case['case_url'],
                            'image_urls': case['image_urls'],
                            'num_images': len(case['image_urls']),
                            'metadata': case['metadata']
                        })
                        
                        category_cases += 1
                        category_images += len(case['image_urls'])
                    
                    total_cases += category_cases
                    total_images += category_images
                    
                    print(f"   ✅ Added {category_cases} cases from {category['name']}")
                    print(f"      🖼️ {category_images} total images")
                else:
                    print(f"   ❌ Failed to select category {category['name']}")
                
                # Be respectful to the server
                time.sleep(3)
                
            except Exception as e:
                print(f"   ❌ Error processing {category['name']}: {e}")
                continue
        
        # Save results
        self.save_results(all_data, total_cases, total_images)
        
        return all_data
    
    def save_results(self, data, total_cases, total_images):
        """Save results to JSON file"""
        output_file = 'pathpresenter_slide_library_data.json'
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            print(f"\n🎉 SCRAPING COMPLETE!")
            print(f"📁 Saved {len(data)} pathology cases to {output_file}")
            
            # Summary statistics
            categories_with_data = len(set(item['category'] for item in data))
            cases_with_diagnosis = sum(1 for item in data if item['diagnosis'])
            cases_with_images = sum(1 for item in data if item['image_urls'])
            
            print(f"📊 Summary:")
            print(f"   - Categories processed: {categories_with_data}")
            print(f"   - Total pathology cases: {len(data)}")
            print(f"   - Cases with diagnosis: {cases_with_diagnosis}")
            print(f"   - Cases with images: {cases_with_images}")
            print(f"   - Total images: {total_images}")
            print(f"   - Unique image URLs: {len(self.seen_image_urls)}")
            
            if len(data) > 0:
                print(f"\n📋 Sample pathology cases:")
                for case in data[:5]:
                    name = case['name'][:50] + '...' if len(case['name']) > 50 else case['name']
                    diagnosis = case['diagnosis'][:30] + '...' if len(case['diagnosis']) > 30 else case['diagnosis']
                    print(f"   - {case['category']}: {name}")
                    if diagnosis:
                        print(f"     🔬 Diagnosis: {diagnosis}")
            
            # Save detailed stats
            stats_file = 'pathpresenter_slide_library_stats.json'
            stats = {
                'total_cases': len(data),
                'categories_processed': categories_with_data,
                'cases_with_diagnosis': cases_with_diagnosis,
                'cases_with_images': cases_with_images,
                'total_images': total_images,
                'unique_image_urls': len(self.seen_image_urls),
                'scraping_timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            
            with open(stats_file, 'w', encoding='utf-8') as f:
                json.dump(stats, f, indent=2, ensure_ascii=False)
            
            print(f"📈 Detailed stats saved to {stats_file}")
            
        except Exception as e:
            print(f"❌ Error saving results: {e}")

def main():
    """Main function"""
    print("PathPresenter Slide Library Scraper v3.0")
    print("=========================================")
    print("This scraper targets the actual pathology slide library.")
    print("Create a free account at: https://pathpresenter.net")
    print()
    
    # Get credentials
    username = input("Enter your PathPresenter username/email: ").strip()
    password = input("Enter your PathPresenter password: ").strip()
    
    if not username or not password:
        print("❌ Username and password are required")
        return
    
    print("\nChoose scraping mode:")
    print("1. Test mode (first 3 categories)")
    print("2. Full scrape (all categories)")
    print("3. Custom number of categories")
    print("4. Specific category (Bone and Soft Tissue)")
    
    try:
        choice = input("\nEnter choice (1-4): ").strip()
        
        if choice == "1":
            max_categories = 3
        elif choice == "2":
            max_categories = None
        elif choice == "3":
            max_categories = int(input("Enter number of categories to scrape: "))
        elif choice == "4":
            max_categories = 1
            print("Will scrape 'Bone and Soft Tissue' category specifically")
        else:
            print("Invalid choice, using test mode")
            max_categories = 3
        
        # Ask about headless mode
        headless_choice = input("\nRun in headless mode? (y/n): ").strip().lower()
        headless = headless_choice in ['y', 'yes']
        
        print(f"\n🚀 Starting PathPresenter Slide Library scraper...")
        print(f"   - Target: Pathology cases from slide library")
        print(f"   - Username: {username}")
        print(f"   - Mode: {'Headless' if headless else 'Visible browser'}")
        print(f"   - Max categories: {max_categories if max_categories else 'All'}")
        print()
        
        # Create scraper and run
        scraper = PathPresenterSlideLibraryScraper(headless=headless)
        scraper.scrape_pathology_categories(username, password, max_categories=max_categories)
        
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